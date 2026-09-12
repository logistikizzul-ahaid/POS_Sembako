/**
 * ==========================================================
 * PRINTER MANAGER - Cetak Struk Thermal dari Browser
 * ==========================================================
 * Mendukung 3 metode, dengan urutan prioritas fallback:
 *   1. Web Bluetooth API   -> printer thermal BT (mis. banyak printer 58mm murah)
 *   2. WebUSB API          -> printer thermal kabel USB yang support WebUSB
 *   3. window.print()      -> fallback universal via driver OS / print dialog
 *
 * CATATAN PENTING:
 * - Web Bluetooth & WebUSB HANYA berjalan di browser berbasis Chromium
 *   (Chrome, Edge, Brave) dan HARUS di HTTPS (Netlify sudah HTTPS by default).
 * - Tidak didukung di Safari/iOS sama sekali -> gunakan fallback window.print().
 * - User harus melakukan gesture (klik tombol) untuk memicu request pairing,
 *   tidak bisa otomatis tanpa interaksi.
 */

// ---------- ESC/POS COMMAND HELPERS ----------
const ESC = 0x1b
const GS = 0x1d

const commands = {
  init: [ESC, 0x40],
  alignLeft: [ESC, 0x61, 0x00],
  alignCenter: [ESC, 0x61, 0x01],
  alignRight: [ESC, 0x61, 0x02],
  boldOn: [ESC, 0x45, 0x01],
  boldOff: [ESC, 0x45, 0x00],
  doubleHeightOn: [GS, 0x21, 0x11],
  doubleHeightOff: [GS, 0x21, 0x00],
  cutPaper: [GS, 0x56, 0x42, 0x00],
  lineFeed: [0x0a],
}

function textToBytes(text) {
  return Array.from(new TextEncoder().encode(text))
}

/**
 * Bangun payload ESC/POS dari data struk terstruktur.
 * receiptData: { store, invoiceNumber, cashierName, items, subtotal, discount,
 *                total, paidAmount, changeAmount, paymentMethod, createdAt }
 */
export function buildEscPosPayload(receiptData, paperSize = '80mm') {
  const width = paperSize === '58mm' ? 32 : 48 // karakter per baris (font default)
  const bytes = []

  const push = (arr) => bytes.push(...arr)
  const pushText = (str) => push(textToBytes(str))

  const line = (char = '-') => char.repeat(width) + '\n'
  const center = (str) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2))
    return ' '.repeat(pad) + str
  }
  const twoCol = (left, right) => {
    const space = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(space) + right
  }

  push(commands.init)
  push(commands.alignCenter)
  push(commands.boldOn)
  push(commands.doubleHeightOn)
  pushText(receiptData.store?.name || 'TOKO SEMBAKO')
  pushText('\n')
  push(commands.doubleHeightOff)
  push(commands.boldOff)

  if (receiptData.store?.address) pushText(receiptData.store.address + '\n')
  if (receiptData.store?.phone_whatsapp) pushText(receiptData.store.phone_whatsapp + '\n')

  push(commands.alignLeft)
  pushText(line('='))
  pushText(twoCol('No. Struk', receiptData.invoiceNumber) + '\n')
  pushText(twoCol('Kasir', receiptData.cashierName || '-') + '\n')
  pushText(twoCol('Tanggal', receiptData.createdAt) + '\n')
  pushText(line('-'))

  receiptData.items.forEach((item) => {
    pushText(item.product_name_snapshot + '\n')
    const qtyPrice = `${item.qty} x ${formatMoney(item.unit_price)}` + (item.price_tier === 'grosir' ? ' (G)' : '')
    pushText(twoCol(qtyPrice, formatMoney(item.line_total)) + '\n')
  })

  pushText(line('-'))
  pushText(twoCol('Subtotal', formatMoney(receiptData.subtotal)) + '\n')
  if (receiptData.discount > 0) {
    pushText(twoCol('Diskon', '-' + formatMoney(receiptData.discount)) + '\n')
  }
  push(commands.boldOn)
  pushText(twoCol('TOTAL', formatMoney(receiptData.total)) + '\n')
  push(commands.boldOff)
  pushText(twoCol('Bayar (' + receiptData.paymentMethod.toUpperCase() + ')', formatMoney(receiptData.paidAmount)) + '\n')
  pushText(twoCol('Kembali', formatMoney(receiptData.changeAmount)) + '\n')
  pushText(line('='))

  push(commands.alignCenter)
  pushText((receiptData.store?.receipt_note || 'Terima kasih!') + '\n\n\n')

  push(commands.cutPaper)

  return new Uint8Array(bytes)
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

// ==========================================================
// METODE 1: WEB BLUETOOTH
// ==========================================================
let btDevice = null
let btCharacteristic = null

// UUID service umum utk printer thermal ESC/POS Bluetooth (SPP-like / generic)
const BT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const BT_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

export async function connectBluetoothPrinter() {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Chrome/Edge di Android/Desktop.')
  }

  btDevice = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BT_SERVICE_UUID] }],
    optionalServices: [BT_SERVICE_UUID],
  })

  const server = await btDevice.gatt.connect()
  const service = await server.getPrimaryService(BT_SERVICE_UUID)
  btCharacteristic = await service.getCharacteristic(BT_CHARACTERISTIC_UUID)

  return { name: btDevice.name }
}

export async function printViaBluetooth(receiptData, paperSize) {
  if (!btCharacteristic) throw new Error('Printer Bluetooth belum terhubung. Sambungkan dulu.')
  const payload = buildEscPosPayload(receiptData, paperSize)

  // Kirim per-chunk (banyak printer BT low-energy punya batas ~180-512 byte per write)
  const CHUNK_SIZE = 180
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE)
    await btCharacteristic.writeValue(chunk)
    await sleep(30) // beri jeda agar buffer printer tidak overflow
  }
}

// ==========================================================
// METODE 2: WEBUSB
// ==========================================================
let usbDevice = null

export async function connectUsbPrinter() {
  if (!navigator.usb) {
    throw new Error('WebUSB tidak didukung di browser ini. Gunakan Chrome/Edge di Desktop.')
  }

  // Tidak filter vendorId spesifik agar kompatibel dengan berbagai merk printer thermal generik
  usbDevice = await navigator.usb.requestDevice({ filters: [] })
  await usbDevice.open()
  if (usbDevice.configuration === null) {
    await usbDevice.selectConfiguration(1)
  }
  await usbDevice.claimInterface(0)

  return { name: usbDevice.productName || 'USB Printer' }
}

export async function printViaUsb(receiptData, paperSize) {
  if (!usbDevice) throw new Error('Printer USB belum terhubung. Sambungkan dulu.')
  const payload = buildEscPosPayload(receiptData, paperSize)

  // Cari endpoint OUT (biasanya endpointNumber 1, tapi kita deteksi otomatis)
  const iface = usbDevice.configuration.interfaces[0]
  const endpointOut = iface.alternate.endpoints.find((e) => e.direction === 'out')

  await usbDevice.transferOut(endpointOut.endpointNumber, payload)
}

// ==========================================================
// METODE 3: WINDOW.PRINT (fallback universal, pakai CSS @media print)
// ==========================================================
export function printViaBrowser() {
  // Komponen <ThermalReceipt> harus sudah di-render di DOM dengan class "thermal-receipt"
  // sebelum fungsi ini dipanggil. Lihat komponen ThermalReceipt.jsx
  window.print()
}

// ==========================================================
// UTIL
// ==========================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isBluetoothConnected() {
  return !!btCharacteristic
}

export function isUsbConnected() {
  return !!usbDevice
}

export function disconnectAll() {
  if (btDevice?.gatt?.connected) btDevice.gatt.disconnect()
  if (usbDevice) usbDevice.close().catch(() => {})
  btDevice = null
  btCharacteristic = null
  usbDevice = null
}
