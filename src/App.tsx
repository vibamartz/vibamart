import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore, useCategoryStore, useSettingsStore } from './store';
import PermissionModal from './components/PermissionModal';

// Layout & Common
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Login from './Login';
import AdminDashboard from './pages/AdminDashboard';
import SellerDashboard from './pages/SellerDashboard';
import Profile from './pages/Profile';
import Wishlist from './pages/Wishlist';
import OrderTracking from './pages/OrderTracking';
import FAQ from './pages/FAQ';
import ProductNotFound from './pages/ProductNotFound';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Simple Error Boundary
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-red-50 text-red-900">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="bg-white p-4 rounded border border-red-200 overflow-auto max-w-full">
            {this.state.error?.toString()}
            {'\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const { initAuth, loading } = useAuthStore();
  const { initCategories, loading: catsLoading } = useCategoryStore();
  const { initSettings, loading: settingsLoading } = useSettingsStore();
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    initAuth();
    initCategories();
    initSettings();
    
    const acknowledged = localStorage.getItem('permissionsAcknowledged');
    if (!acknowledged) {
      setShowPermissions(true);
    }
  }, []);

  const handlePermissionsAccept = () => {
    localStorage.setItem('permissionsAcknowledged', 'true');
    setShowPermissions(false);
  };

  if (loading || catsLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Initializing ViBa Mart...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/track-order" element={<OrderTracking />} />
              <Route path="/track-order/:orderId" element={<OrderTracking />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/product-not-found" element={<ProductNotFound />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a1a1a',
                color: '#fff',
                borderRadius: '16px',
                fontWeight: 600,
                fontSize: '14px',
                padding: '16px 24px',
              },
            }}
          />
          <PermissionModal 
            isOpen={showPermissions} 
            onClose={() => setShowPermissions(false)}
            onAccept={handlePermissionsAccept}
          />
          <SpeedInsights />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
