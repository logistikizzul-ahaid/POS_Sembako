import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatRupiah } from '../utils/pricing'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Laporan harian: total omzet, metode pembayaran, item terlaris, dan margin.
 * Data dihitung dari transaction_items (yang menyimpan snapshot harga & cost saat itu).
 */
export default function ReportsPage() {
  const { profile, store } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [items, setItems] = useState([])

  async function loadReport() {
    setLoading(true)
    const start = `${date}T00:00:00`
    const end = `${date}T23:59:59`

    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('store_id', profile.store_id)
      .gte('created_at', start)
      .lte('created_at', end)
      .eq('status', 'completed')

    setTransactions(txs || [])

    if (txs && txs.length > 0) {
      const txIds = txs.map((t) => t.id)
      const { data: itemRows } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txIds)
      setItems(itemRows || [])
    } else {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => { loadReport() }, [date])

  // ---- Kalkulasi ringkasan ----
  const totalOmzet = transactions.reduce((sum, t) => sum + Number(t.total), 0)
  const byPayment = groupSum(transactions, 'payment_method', 'total')
  const totalMargin = items.reduce(
    (sum, i) => sum + (Number(i.line_total) - Number(i.cost_price_snapshot) * Number(i.qty)), 0
  )

  const productSales = {}
  items.forEach((i) => {
    if (!productSales[i.product_name_snapshot]) {
      productSales[i.product_name_snapshot] = { qty: 0, total: 0 }
    }
    productSales[i.product_name_snapshot].qty += Number(i.qty)
    productSales[i.product_name_snapshot].total += Number(i.line_total)
  })
  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)

  function exportExcel() {
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.json_to_sheet([
      { Metrik: 'Total Omzet', Nilai: totalOmzet },
      { Metrik: 'Estimasi Margin', Nilai: totalMargin },
      { Metrik: 'Jumlah Transaksi', Nilai: transactions.length },
      ...Object.entries(byPayment).map(([method, total]) => ({ Metrik: `Bayar - ${method}`, Nilai: total })),
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan')

    const productSheet = XLSX.utils.json_to_sheet(
      topProducts.map(([name, d]) => ({ Produk: name, Qty: d.qty, Total: d.total }))
    )
    XLSX.utils.book_append_sheet(wb, productSheet, 'Item Terlaris')

    XLSX.writeFile(wb, `laporan-${date}.xlsx`)
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`Laporan Penjualan - ${store?.name || ''}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Tanggal: ${date}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [['Metrik', 'Nilai']],
      body: [
        ['Total Omzet', formatRupiah(totalOmzet)],
        ['Estimasi Margin', formatRupiah(totalMargin)],
        ['Jumlah Transaksi', String(transactions.length)],
        ...Object.entries(byPayment).map(([method, total]) => [`Bayar - ${method}`, formatRupiah(total)]),
      ],
    })

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Produk', 'Qty Terjual', 'Total']],
      body: topProducts.map(([name, d]) => [name, d.qty, formatRupiah(d.total)]),
    })

    doc.save(`laporan-${date}.pdf`)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Laporan Harian</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2" />
          <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Export Excel</button>
          <button onClick={exportPdf} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Export PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Memuat laporan...</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Omzet" value={formatRupiah(totalOmzet)} />
            <SummaryCard label="Estimasi Margin" value={formatRupiah(totalMargin)} />
            <SummaryCard label="Jumlah Transaksi" value={transactions.length} />
            <SummaryCard label="Rata-rata / Transaksi" value={formatRupiah(transactions.length ? totalOmzet / transactions.length : 0)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-semibold mb-3">Metode Pembayaran</h2>
              {Object.entries(byPayment).map(([method, total]) => (
                <div key={method} className="flex justify-between py-1 text-sm capitalize">
                  <span>{method}</span>
                  <span className="font-medium">{formatRupiah(total)}</span>
                </div>
              ))}
              {Object.keys(byPayment).length === 0 && <div className="text-gray-400 text-sm">Belum ada transaksi.</div>}
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-semibold mb-3">Item Terlaris</h2>
              {topProducts.map(([name, d]) => (
                <div key={name} className="flex justify-between py-1 text-sm">
                  <span>{name} <span className="text-gray-400">x{d.qty}</span></span>
                  <span className="font-medium">{formatRupiah(d.total)}</span>
                </div>
              ))}
              {topProducts.length === 0 && <div className="text-gray-400 text-sm">Belum ada transaksi.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  )
}

function groupSum(rows, groupKey, sumKey) {
  const result = {}
  rows.forEach((r) => {
    result[r[groupKey]] = (result[r[groupKey]] || 0) + Number(r[sumKey])
  })
  return result
}
