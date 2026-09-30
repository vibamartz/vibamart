import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './desktop/components/Logo';
import { useAuthStore, useCategoryStore, useSettingsStore, useFeatureStore, useRewardsStore } from './backend/store';
import { useIsMobile } from './shared/utilities/useIsMobile';
import { useDoubleBackToExit } from './shared/hooks/useDoubleBackToExit';
import PermissionModal from './desktop/components/PermissionModal';
import GlobalPushNotificationListener from './shared/components/GlobalPushNotificationListener';
import ProfessionalErrorState from './shared/components/ProfessionalErrorState';

// Core Layout Components (Fast Shell)
import Navbar from './desktop/components/Navbar';
import Footer from './desktop/components/Footer';
import MobileHeader from './mobile/components/MobileHeader';
import MobileBottomNav from './mobile/components/MobileBottomNav';

// Desktop UI - Lazy Loaded Pages for Instant Initial Render
const Home = lazy(() => import('./desktop/pages/Home'));
const ProductList = lazy(() => import('./desktop/pages/ProductList'));
const ProductDetail = lazy(() => import('./desktop/pages/ProductDetail'));
const Cart = lazy(() => import('./desktop/pages/Cart'));
const Checkout = lazy(() => import('./desktop/pages/Checkout'));
const OrderSuccess = lazy(() => import('./desktop/pages/OrderSuccess'));
const Login = lazy(() => import('./Login'));
const AdminDashboard = lazy(() => import('./desktop/pages/AdminDashboard'));
const SellerDashboard = lazy(() => import('./desktop/pages/SellerDashboard'));
const Profile = lazy(() => import('./desktop/pages/Profile'));
const Wishlist = lazy(() => import('./desktop/pages/Wishlist'));
const OrderTracking = lazy(() => import('./desktop/pages/OrderTracking'));
const RequestTracking = lazy(() => import('./desktop/pages/RequestTracking'));
const FAQ = lazy(() => import('./desktop/pages/FAQ'));
const ProductNotFound = lazy(() => import('./desktop/pages/ProductNotFound'));
const Rewards = lazy(() => import('./desktop/pages/Rewards'));
const RewardProducts = lazy(() => import('./desktop/pages/RewardProducts'));
const Deal259Page = lazy(() => import('./desktop/pages/Deal259Page'));
const TermsOfService = lazy(() => import('./desktop/pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./desktop/pages/PrivacyPolicy'));
const ContactUs = lazy(() => import('./desktop/pages/ContactUs'));

// Mobile UI - Lazy Loaded Pages
const MobileHomepage = lazy(() => import('./mobile/pages/MobileHomepage'));
const MobileCategoriesScreen = lazy(() => import('./mobile/pages/MobileCategoriesScreen'));
const MobileSearchScreen = lazy(() => import('./mobile/pages/MobileSearchScreen'));
const MobileProductListScreen = lazy(() => import('./mobile/pages/MobileProductListScreen'));
const MobileProductDetailScreen = lazy(() => import('./mobile/pages/MobileProductDetailScreen'));
const MobileCartScreen = lazy(() => import('./mobile/pages/MobileCartScreen'));
const MobileCheckoutScreen = lazy(() => import('./mobile/pages/MobileCheckoutScreen'));
const MobileOrderSuccessScreen = lazy(() => import('./mobile/pages/MobileOrderSuccessScreen'));
const MobileProfileScreen = lazy(() => import('./mobile/pages/MobileProfileScreen'));
const MobileWishlistScreen = lazy(() => import('./mobile/pages/MobileWishlistScreen'));
const MobileOrdersScreen = lazy(() => import('./mobile/pages/MobileOrdersScreen'));
const MobileOrderDetailsScreen = lazy(() => import('./mobile/pages/MobileOrderDetailsScreen'));
const MobileAddressScreen = lazy(() => import('./mobile/pages/MobileAddressScreen'));
const MobileNotificationsScreen = lazy(() => import('./mobile/pages/MobileNotificationsScreen'));
const MobileOffersScreen = lazy(() => import('./mobile/pages/MobileOffersScreen'));
const MobileRewardsScreen = lazy(() => import('./mobile/pages/MobileRewardsScreen'));
const MobileRewardProductsScreen = lazy(() => import('./mobile/pages/MobileRewardProductsScreen'));

// ViBa CI/CD Platform Dashboard & Pages (Lazy Loaded)
const CiCdDashboard = lazy(() => import('./cicd/pages/CiCdDashboard'));
const ServicesPage = lazy(() => import('./cicd/pages/ServicesPage'));
const PipelinesPage = lazy(() => import('./cicd/pages/PipelinesPage'));
const DeploymentsPage = lazy(() => import('./cicd/pages/DeploymentsPage'));
const SecretsPage = lazy(() => import('./cicd/pages/SecretsPage'));
const AuditLogsPage = lazy(() => import('./cicd/pages/AuditLogsPage'));
const BuildsPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.BuildsPage })));
const EnvironmentsPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.EnvironmentsPage })));
const ClustersPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.ClustersPage })));
const SecurityPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.SecurityPage })));
const MonitoringPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.MonitoringPage })));
const LogsPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.LogsPage })));
const ArtifactsPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.ArtifactsPage })));
const RepositoriesPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.RepositoriesPage })));
const SettingsPage = lazy(() => import('./cicd/pages/OtherPages').then(m => ({ default: m.SettingsPage })));

// Sleek lightweight route loader
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Error Boundary with Professional Error UI
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled Application Error:', error, errorInfo);
  }

  handleRetry = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <ProfessionalErrorState
            type="error"
            title="Something went wrong"
            description="We couldn't complete this request right now. Please try again."
            onAction={this.handleRetry}
            actionText="Try Again"
          />
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function MainAppRoutes() {
  const isMobile = useIsMobile();
  useDoubleBackToExit();

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col font-sans bg-white selection:bg-primary selection:text-white overflow-x-hidden w-full">
        <MobileHeader />
        <main className="flex-1 w-full max-w-[768px] mx-auto min-w-0 pb-20 sm:pb-24">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<MobileHomepage />} />
              <Route path="/for-you" element={<MobileHomepage />} />
              <Route path="/mobile" element={<MobileHomepage />} />
              <Route path="/mobile-home" element={<MobileHomepage />} />
              <Route path="/category/:categorySlug" element={<MobileHomepage />} />
              <Route path="/categories" element={<MobileCategoriesScreen />} />
              <Route path="/categories/:categorySlug" element={<MobileProductListScreen />} />
              <Route path="/categories/:categorySlug/:subcategorySlug" element={<MobileProductListScreen />} />
              <Route path="/categories/:categorySlug/:subcategorySlug/:nestedSubcategorySlug" element={<MobileProductListScreen />} />
              <Route path="/brands/:brandSlug" element={<MobileProductListScreen />} />
              <Route path="/search" element={<MobileSearchScreen />} />
              <Route path="/products" element={<MobileProductListScreen />} />
              <Route path="/products/:slug" element={<MobileProductDetailScreen />} />
              <Route path="/product/:id" element={<MobileProductDetailScreen />} />
              <Route path="/cart" element={<MobileCartScreen />} />
              <Route path="/checkout" element={<MobileCheckoutScreen />} />
              <Route path="/order-success" element={<MobileOrderSuccessScreen />} />
              <Route path="/profile" element={<MobileProfileScreen />} />
              <Route path="/wishlist" element={<MobileWishlistScreen />} />
              <Route path="/orders" element={<MobileOrdersScreen />} />
              <Route path="/track-order" element={<MobileOrdersScreen />} />
              <Route path="/track-order/:orderId" element={<MobileOrderDetailsScreen />} />
              <Route path="/requests" element={<MobileOrdersScreen />} />
              <Route path="/returns" element={<MobileOrdersScreen />} />
              <Route path="/addresses" element={<MobileAddressScreen />} />
              <Route path="/notifications" element={<MobileNotificationsScreen />} />
              <Route path="/offers" element={<MobileOffersScreen />} />
              <Route path="/deal259" element={<Deal259Page />} />
              <Route path="/offers/:offerSlug" element={<MobileProductListScreen />} />
              <Route path="/offer/:offerSlug" element={<MobileProductListScreen />} />
              <Route path="/banner/:offerSlug" element={<MobileProductListScreen />} />
              <Route path="/banners/:offerSlug" element={<MobileProductListScreen />} />
              <Route path="/rewards" element={<MobileRewardsScreen />} />
              <Route path="/rewards/:rewardSlug" element={<MobileRewardProductsScreen />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/cicd" element={<CiCdDashboard />} />
              <Route path="/cicd/services" element={<ServicesPage />} />
              <Route path="/cicd/repositories" element={<RepositoriesPage />} />
              <Route path="/cicd/pipelines" element={<PipelinesPage />} />
              <Route path="/cicd/pipelines/:id" element={<PipelinesPage />} />
              <Route path="/cicd/builds" element={<BuildsPage />} />
              <Route path="/cicd/artifacts" element={<ArtifactsPage />} />
              <Route path="/cicd/deployments" element={<DeploymentsPage />} />
              <Route path="/cicd/environments" element={<EnvironmentsPage />} />
              <Route path="/cicd/clusters" element={<ClustersPage />} />
              <Route path="/cicd/secrets" element={<SecretsPage />} />
              <Route path="/cicd/security" element={<SecurityPage />} />
              <Route path="/cicd/logs" element={<LogsPage />} />
              <Route path="/cicd/monitoring" element={<MonitoringPage />} />
              <Route path="/cicd/audit" element={<AuditLogsPage />} />
              <Route path="/cicd/settings" element={<SettingsPage />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="*" element={<MobileHomepage />} />
            </Routes>
          </Suspense>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/for-you" element={<Home />} />
            <Route path="/mobile" element={<MobileHomepage />} />
            <Route path="/mobile-home" element={<MobileHomepage />} />
            <Route path="/home-mobile" element={<MobileHomepage />} />
            <Route path="/category/:categorySlug" element={<Home />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/categories/:categorySlug" element={<ProductList />} />
            <Route path="/categories/:categorySlug/:subcategorySlug" element={<ProductList />} />
            <Route path="/categories/:categorySlug/:subcategorySlug/:nestedSubcategorySlug" element={<ProductList />} />
            <Route path="/brands/:brandSlug" element={<ProductList />} />
            <Route path="/offers" element={<ProductList />} />
            <Route path="/deal259" element={<Deal259Page />} />
            <Route path="/offers/:offerSlug" element={<ProductList />} />
            <Route path="/offer/:offerSlug" element={<ProductList />} />
            <Route path="/banner/:offerSlug" element={<ProductList />} />
            <Route path="/banners/:offerSlug" element={<ProductList />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/cicd" element={<CiCdDashboard />} />
            <Route path="/cicd/services" element={<ServicesPage />} />
            <Route path="/cicd/repositories" element={<RepositoriesPage />} />
            <Route path="/cicd/pipelines" element={<PipelinesPage />} />
            <Route path="/cicd/pipelines/:id" element={<PipelinesPage />} />
            <Route path="/cicd/builds" element={<BuildsPage />} />
            <Route path="/cicd/artifacts" element={<ArtifactsPage />} />
            <Route path="/cicd/deployments" element={<DeploymentsPage />} />
            <Route path="/cicd/environments" element={<EnvironmentsPage />} />
            <Route path="/cicd/clusters" element={<ClustersPage />} />
            <Route path="/cicd/secrets" element={<SecretsPage />} />
            <Route path="/cicd/security" element={<SecurityPage />} />
            <Route path="/cicd/logs" element={<LogsPage />} />
            <Route path="/cicd/monitoring" element={<MonitoringPage />} />
            <Route path="/cicd/audit" element={<AuditLogsPage />} />
            <Route path="/cicd/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/rewards/:rewardSlug" element={<RewardProducts />} />
            <Route path="/track-order" element={<OrderTracking />} />
            <Route path="/track-order/:orderId" element={<OrderTracking />} />
            <Route path="/track-request/:requestId" element={<RequestTracking />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/product-not-found" element={<ProductNotFound />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function SplashScreen({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="viba-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white select-none pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center justify-center p-6"
          >
            <Logo showTextOnMobile={true} className="scale-125 sm:scale-150 transform transition-transform" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const { initAuth } = useAuthStore();
  const { initCategories } = useCategoryStore();
  const { initSettings } = useSettingsStore();
  const [showPermissions, setShowPermissions] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Immediately hide native Capacitor/Android launch splash screen on app mount
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.Capacitor?.Plugins?.SplashScreen) {
        try {
          win.Capacitor.Plugins.SplashScreen.hide();
        } catch (e) {
          // ignore if splashscreen plugin not initialized
        }
      }
    }

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

  return (
    <ErrorBoundary>
      <SplashScreen isVisible={showSplash} />
      <Router>
        <ScrollToTop />
        <GlobalPushNotificationListener />
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
      </Router>
    </ErrorBoundary>
  );
}
