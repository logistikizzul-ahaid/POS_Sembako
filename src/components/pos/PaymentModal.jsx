import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { calculateCartTotals, calculateChange, formatRupiah } from '../../utils/pricing'
import {
  connectBluetoothPrinter, printViaBluetooth, isBluetoothConnected,
  connectUsbPrinter, printViaUsb, isUsbConnected,
  printViaBrowser,
} from '../printer/PrinterManager'
import { useAuth } from '../../contexts/AuthContext'

const PAYMENT_METHODS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' },
]

export default function PaymentModal({ cartItems, store, onClose, onSuccess }) {
  const { profile } = useAuth()
  const { lines, subtotal } = calculateCartTotals(cartItems, store)

  const [paymentMethod, setPaymentMethod] = useState('tunai')
  const [paidAmount, setPaidAmount] = useState(subtotal)
  const [discount, setDiscount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [printMethod, setPrintMethod] = useState('browser') // 'bluetooth' | 'usb' | 'browser'
  const [error, setError] = useState('')
  const [lastReceipt, setLastReceipt] = useState(null)

  const total = Math.max(0, subtotal - Number(discount || 0))
  const change = calculateChange(total, paidAmount)

  async function handleConfirm() {
    setError('')
    if (paymentMethod === 'tunai' && Number(paidAmount) < total) {
      setError('Uang bayar kurang dari total belanja.')
      return
    }
    setSaving(true)
    try {
      // 1. Insert transaction header
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          store_id: profile.store_id,
          cashier_id: profile.id,
          subtotal,
          discount,
          total,
          paid_amount: paymentMethod === 'tunai' ? paidAmount : total,
          change_amount: paymentMethod === 'tunai' ? change : 0,
          payment_method: paymentMethod,
        })
        .select()
        .single()

      if (txErr) throw txErr

      // 2. Insert transaction items (snapshot harga & tier saat ini)
      const itemsPayload = lines.map((line) => ({
        transaction_id: tx.id,
        product_id: line.product.id,
        product_name_snapshot: line.product.name,
        qty: line.qty,
        unit_price: line.unitPrice,
        price_tier: line.tier,
        cost_price_snapshot: line.product.cost_price || 0,
        line_total: line.lineTotal,
      }))

      const { error: itemsErr } = await supabase.from('transaction_items').insert(itemsPayload)
      if (itemsErr) throw itemsErr

      // 3. Siapkan data struk & cetak
      const receiptData = {
        invoiceNumber: tx.invoice_number,
        cashierName: profile.full_name,
        createdAt: new Date(tx.created_at).toLocaleString('id-ID'),
        items: itemsPayload,
        subtotal,
        discount,
        total,
        paidAmount: paymentMethod === 'tunai' ? paidAmount : total,
        changeAmount: paymentMethod === 'tunai' ? change : 0,
        paymentMethod,
      }
      setLastReceipt(receiptData)

      await handlePrint(receiptData)

      onSuccess?.(tx)
    } catch (e) {
      setError(e.message || 'Gagal menyimpan transaksi.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrint(receiptData) {
    try {
      if (printMethod === 'bluetooth') {
        if (!isBluetoothConnected()) await connectBluetoothPrinter()
        await printViaBluetooth(receiptData, store?.receipt_paper_size)
      } else if (printMethod === 'usb') {
        if (!isUsbConnected()) await connectUsbPrinter()
        await printViaUsb(receiptData, store?.receipt_paper_size)
      } else {
        // Browser print butuh komponen <ThermalReceipt> dgn data ini sudah ter-render
        // di halaman induk (POSPage) sebelum window.print() dipanggil.
        setTimeout(() => printViaBrowser(), 100)
      }
    } catch (e) {
      setError('Transaksi tersimpan, tapi gagal cetak: ' + e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Pembayaran</h2>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>

          <div>
            <label className="text-sm text-gray-600">Diskon (Rp)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>

          <div>
            <label className="text-sm text-gray-600">Metode Pembayaran</label>
            <div className="flex gap-2 mt-1">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 py-2 rounded border ${
                    paymentMethod === m.value
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'tunai' && (
            <div>
              <label className="text-sm text-gray-600">Uang Diterima</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
              <div className="text-sm text-gray-600 mt-1">
                Kembalian: <span className="font-semibold">{formatRupiah(change)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">Metode Cetak Struk</label>
            <select
              value={printMethod}
              onChange={(e) => setPrintMethod(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="browser">Standar (Print Dialog / driver OS)</option>
              <option value="bluetooth">Bluetooth Thermal</option>
              <option value="usb">USB Thermal (WebUSB)</option>
            </select>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-gray-300">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2 rounded bg-brand-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Selesaikan & Cetak'}
          </button>
        </div>
      </div>
    </div>
  )
}
