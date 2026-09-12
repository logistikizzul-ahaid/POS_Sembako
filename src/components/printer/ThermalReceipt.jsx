import { formatRupiah } from '../../utils/pricing'

/**
 * Komponen struk dalam bentuk HTML biasa, disembunyikan di layar (display:none)
 * dan hanya muncul saat window.print() dipanggil, berkat CSS di index.css
 * (.thermal-receipt { display: none } + @media print override).
 *
 * Render komponen ini SELALU di halaman POS (tersembunyi), lalu panggil
 * printViaBrowser() dari PrinterManager.js saat kasir klik "Cetak (Standar)".
 */
export default function ThermalReceipt({ receiptData, store }) {
  if (!receiptData) return null
  const sizeClass = store?.receipt_paper_size === '58mm' ? 'size-58mm' : 'size-80mm'

  return (
    <div className={`thermal-receipt ${sizeClass}`}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>
        {store?.name || 'TOKO SEMBAKO'}
      </div>
      {store?.address && <div style={{ textAlign: 'center' }}>{store.address}</div>}
      {store?.phone_whatsapp && <div style={{ textAlign: 'center' }}>{store.phone_whatsapp}</div>}

      <hr />
      <div>No. Struk: {receiptData.invoiceNumber}</div>
      <div>Kasir: {receiptData.cashierName}</div>
      <div>Tanggal: {receiptData.createdAt}</div>
      <hr />

      {receiptData.items.map((item, idx) => (
        <div key={idx} style={{ marginBottom: 2 }}>
          <div>{item.product_name_snapshot}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {item.qty} x {formatRupiah(item.unit_price)}
              {item.price_tier === 'grosir' ? ' (G)' : ''}
            </span>
            <span>{formatRupiah(item.line_total)}</span>
          </div>
        </div>
      ))}

      <hr />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span><span>{formatRupiah(receiptData.subtotal)}</span>
      </div>
      {receiptData.discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Diskon</span><span>-{formatRupiah(receiptData.discount)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span>TOTAL</span><span>{formatRupiah(receiptData.total)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Bayar ({receiptData.paymentMethod.toUpperCase()})</span>
        <span>{formatRupiah(receiptData.paidAmount)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Kembali</span><span>{formatRupiah(receiptData.changeAmount)}</span>
      </div>
      <hr />
      <div style={{ textAlign: 'center' }}>{store?.receipt_note || 'Terima kasih!'}</div>
    </div>
  )
}
