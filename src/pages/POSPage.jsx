import { useState } from 'react'
import ProductSearch from '../components/pos/ProductSearch'
import Cart from '../components/pos/Cart'
import PaymentModal from '../components/pos/PaymentModal'
import ThermalReceipt from '../components/printer/ThermalReceipt'
import { useAuth } from '../contexts/AuthContext'

export default function POSPage() {
  const { store } = useAuth()
  const [cartItems, setCartItems] = useState([]) // [{ product, qty, manualOverride }]
  const [showPayment, setShowPayment] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)

  function handleSelectProduct(product) {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === product.id)
      if (existingIdx >= 0) {
        const copy = [...prev]
        copy[existingIdx] = { ...copy[existingIdx], qty: copy[existingIdx].qty + 1 }
        return copy
      }
      return [...prev, { product, qty: 1, manualOverride: 'auto' }]
    })
  }

  function handlePaymentSuccess() {
    setCartItems([])
    setShowPayment(false)
    // lastReceipt tetap disimpan sebentar untuk keperluan cetak ulang jika perlu
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col p-4 gap-4">
      <ProductSearch onSelectProduct={handleSelectProduct} />

      <div className="flex-1 bg-white rounded-xl shadow p-4 flex flex-col overflow-hidden">
        <Cart cartItems={cartItems} setCartItems={setCartItems} store={store} />
      </div>

      <button
        disabled={cartItems.length === 0}
        onClick={() => setShowPayment(true)}
        className="bg-brand-600 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-40"
      >
        Bayar
      </button>

      {showPayment && (
        <PaymentModal
          cartItems={cartItems}
          store={store}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Komponen struk tersembunyi, hanya muncul saat window.print() dipanggil */}
      <ThermalReceipt receiptData={lastReceipt} store={store} />
    </div>
  )
}
