import { Outlet } from 'react-router-dom'

import Footer from '../components/layout/Footer.jsx'
import Header from '../components/layout/Header.jsx'

function CustomerLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main><Outlet /></main>
      <Footer />
    </div>
  )
}

export default CustomerLayout
