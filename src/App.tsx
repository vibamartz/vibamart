import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore, useCategoryStore, useSettingsStore, useFeatureStore, useRewardsStore } from './backend/store';
import { useIsMobile } from './shared/utilities/useIsMobile';
import PermissionModal from './desktop/components/PermissionModal';

// Desktop UI (Isolated Desktop Fronted)
import Navbar from './desktop/components/Navbar';
import Footer from './desktop/components/Footer';
import Home from './desktop/pages/Home';
import ProductList from './desktop/pages/ProductList';
import ProductDetail from './desktop/pages/ProductDetail';
import Cart from './desktop/pages/Cart';
import Checkout from './desktop/pages/Checkout';
import OrderSuccess from './desktop/pages/OrderSuccess';
import Login from './Login';
import AdminDashboard from './desktop/pages/AdminDashboard';
import SellerDashboard from './desktop/pages/SellerDashboard';
import Profile from './desktop/pages/Profile';
import Wishlist from './desktop/pages/Wishlist';
import OrderTracking from './desktop/pages/OrderTracking';
import RequestTracking from './desktop/pages/RequestTracking';
import FAQ from './desktop/pages/FAQ';
import ProductNotFound from './desktop/pages/ProductNotFound';
import Rewards from './desktop/pages/Rewards';

// Mobile UI (Isolated Mobile Frontend)
import MobileHeader from './mobile/components/MobileHeader';
import MobileBottomNav from './mobile/components/MobileBottomNav';
import MobileHomepage from './mobile/pages/MobileHomepage';
import MobileCategoriesScreen from './mobile/pages/MobileCategoriesScreen';
import MobileSearchScreen from './mobile/pages/MobileSearchScreen';
import MobileProductListScreen from './mobile/pages/MobileProductListScreen';
import MobileProductDetailScreen from './mobile/pages/MobileProductDetailScreen';
import MobileCartScreen from './mobile/pages/MobileCartScreen';
import MobileCheckoutScreen from './mobile/pages/MobileCheckoutScreen';
import MobileOrderSuccessScreen from './mobile/pages/MobileOrderSuccessScreen';
import MobileProfileScreen from './mobile/pages/MobileProfileScreen';
import MobileWishlistScreen from './mobile/pages/MobileWishlistScreen';
import MobileOrdersScreen from './mobile/pages/MobileOrdersScreen';
import MobileOrderDetailsScreen from './mobile/pages/MobileOrderDetailsScreen';
import MobileRequestScreens from './mobile/pages/MobileRequestScreens';
import MobileAddressScreen from './mobile/pages/MobileAddressScreen';
import MobileNotificationsScreen from './mobile/pages/MobileNotificationsScreen';
import MobileOffersScreen from './mobile/pages/MobileOffersScreen';
import MobileRewardsScreen from './mobile/pages/MobileRewardsScreen';

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
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-red-50 text-red-900 font-sans">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="bg-white p-4 rounded border border-red-200 overflow-auto max-w-full text-xs">
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

function MainAppRoutes() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-[#FFF3EB] selection:bg-primary selection:text-white">
        <MobileHeader />
        <main className="flex-1 max-w-md mx-auto w-full">
          <Routes>
            <Route path="/" element={<MobileHomepage />} />
            <Route path="/mobile" element={<MobileHomepage />} />
            <Route path="/mobile-home" element={<MobileHomepage />} />
            <Route path="/categories" element={<MobileCategoriesScreen />} />
            <Route path="/search" element={<MobileSearchScreen />} />
            <Route path="/products" element={<MobileProductListScreen />} />
            <Route path="/product/:id" element={<MobileProductDetailScreen />} />
            <Route path="/cart" element={<MobileCartScreen />} />
            <Route path="/checkout" element={<MobileCheckoutScreen />} />
            <Route path="/order-success" element={<MobileOrderSuccessScreen />} />
            <Route path="/profile" element={<MobileProfileScreen />} />
            <Route path="/wishlist" element={<MobileWishlistScreen />} />
            <Route path="/orders" element={<MobileOrdersScreen />} />
            <Route path="/track-order" element={<MobileOrdersScreen />} />
            <Route path="/track-order/:orderId" element={<MobileOrderDetailsScreen />} />
            <Route path="/requests" element={<MobileRequestScreens />} />
            <Route path="/returns" element={<MobileRequestScreens />} />
            <Route path="/addresses" element={<MobileAddressScreen />} />
            <Route path="/notifications" element={<MobileNotificationsScreen />} />
            <Route path="/offers" element={<MobileOffersScreen />} />
            <Route path="/rewards" element={<MobileRewardsScreen />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="*" element={<MobileHomepage />} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mobile" element={<MobileHomepage />} />
          <Route path="/mobile-home" element={<MobileHomepage />} />
          <Route path="/home-mobile" element={<MobileHomepage />} />
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
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/track-order" element={<OrderTracking />} />
          <Route path="/track-order/:orderId" element={<OrderTracking />} />
          <Route path="/track-request/:requestId" element={<RequestTracking />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/product-not-found" element={<ProductNotFound />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
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
    useFeatureStore.getState().initFeatures();
    useRewardsStore.getState().initRewards();
    
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
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 font-sans">
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
        <MainAppRoutes />
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
      </Router>
    </ErrorBoundary>
  );
}
