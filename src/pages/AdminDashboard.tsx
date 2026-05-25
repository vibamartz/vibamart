import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useCategoryStore } from '../store';
import { Navigate, Link } from 'react-router-dom';
import {
  BarChart3, Users, Package, ShoppingBag,
  Settings, LogOut, ChevronRight, TrendingUp,
  Plus, Search, Filter, MoreVertical, Download, Truck, MapPin,
  FileText, Calendar, CreditCard, PieChart, Activity, Bell, Image, Layout,
  Shield, UserPlus, Check, X, Eye, ChevronDown, Edit3, Trash2, Hash, ArrowUp, ArrowDown,
  Upload, Link2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, setDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { logAdminAction, AdminAction } from '../services/adminLogService';
import { Role, UserProfile, Product, ProductVariant, Order, OrderStatus, Coupon, Banner, Review, Announcement, ReturnRequest, Category, SubCategory } from '../types';
import { CATEGORIES, AVAILABLE_PERMISSIONS } from '../constants';
import ProductCard from '../components/ProductCard';
import AdminOrderDetailsView from '../components/AdminOrderDetailsView';

const STATS = [
  { label: 'Total Revenue', value: '₹0', change: '0%', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5' },
  { label: 'Total Orders', value: '0', change: '0%', icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary/5' },
  { label: 'Total Customers', value: '0', change: '0%', icon: Users, color: 'text-primary', bg: 'bg-primary/5' },
  { label: 'Active Products', value: '0', change: '0%', icon: Package, color: 'text-secondary', bg: 'bg-secondary/5' },
];

const SALES_DATA = [
  { month: 'Jan', sales: 45000 },
  { month: 'Feb', sales: 52000 },
  { month: 'Mar', sales: 48000 },
  { month: 'Apr', sales: 61000 },
  { month: 'May', sales: 55000 },
  { month: 'Jun', sales: 67000 },
];

const sanitizeImageUrl = (url: string) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^data:image\/[a-z+]+;base64,/i.test(trimmed)) {
    return trimmed;
  }
  return '';
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  if (user?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  const handleDeleteProduct = async (productId: string, productName: string) => {
    console.log('handleDeleteProduct called for:', productId, productName);
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE "${productName}"? This cannot be undone.`)) return false;

    const toastId = toast.loading('Deleting product...');
    try {
      console.log('Attempting deleteDoc for:', productId);
      await deleteDoc(doc(db, 'products', productId));
      console.log('deleteDoc succeeded for:', productId);

      // Log the action (don't let log failure block success)
      try {
        await logAdminAction(AdminAction.PRODUCT_DELETE, `Deleted product: ${productName}`, productId, 'products');
      } catch (logErr) {
        console.warn('Logging failed but deletion succeeded:', logErr);
      }

      toast.success('Product deleted successfully', { id: toastId });
      return true;
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Deletion failed: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId });
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      return false;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-100 italic">
          <Link to="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
            <Logo />
            <span className="font-bold text-gray-800">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={BarChart3} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Package} label="Products" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
          <SidebarItem icon={ShoppingBag} label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <SidebarItem icon={TrendingUp} label="Returns" active={activeTab === 'returns'} onClick={() => setActiveTab('returns')} />
          <SidebarItem icon={Users} label="Customers" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
          <SidebarItem icon={Shield} label="User Management" active={activeTab === 'user-roles'} onClick={() => setActiveTab('user-roles')} />
          <SidebarItem icon={FileText} label="Sales Reports" active={activeTab === 'sales-reports'} onClick={() => setActiveTab('sales-reports')} />
          <SidebarItem icon={CreditCard} label="Payment Reports" active={activeTab === 'payment-reports'} onClick={() => setActiveTab('payment-reports')} />
          <SidebarItem icon={Activity} label="Activity Logs" active={activeTab === 'activity-logs'} onClick={() => setActiveTab('activity-logs')} />
          <SidebarItem icon={Image} label="Banners" active={activeTab === 'banners'} onClick={() => setActiveTab('banners')} />
          <SidebarItem icon={Image} label="Categories" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
          <SidebarItem icon={TrendingUp} label="Coupons" active={activeTab === 'coupons'} onClick={() => setActiveTab('coupons')} />
          <SidebarItem icon={Activity} label="Reviews" active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} />
          <SidebarItem icon={Users} label="Vendors" active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} />
          <SidebarItem icon={Bell} label="Announcements" active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} />
          <SidebarItem icon={BarChart3} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => {
              logAdminAction(AdminAction.USER_ROLE_UPDATE, 'Admin initiated logout.');
              // In a real app, this would call auth.signOut()
            }}
            className="flex items-center gap-3 text-gray-500 hover:text-red-600 px-4 py-3 w-full transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8">
          <h1 className="text-xl font-bold text-gray-800 capitalize">{activeTab}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input type="text" placeholder="Search..." className="bg-gray-50 border-none rounded-lg px-4 py-2 pl-10 text-sm w-64 focus:ring-2 focus:ring-primary/20" />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
              {user.displayName?.[0] || user.email?.[0] || 'A'}
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-64px)]">
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {STATS.map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`${stat.bg} p-3 rounded-xl`}>
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                      <span className={`text-xs font-bold ${stat.change.startsWith('+') ? 'text-blue-600' : 'text-red-500'}`}>
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Revenue Overview</h3>
                    <select className="bg-gray-50 border-none text-xs font-bold rounded-lg px-3 py-2 outline-none">
                      <option>Last 6 Months</option>
                      <option>Last Year</option>
                    </select>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={SALES_DATA}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1e40af" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="sales" stroke="#1e40af" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold mb-6">Quick Actions</h3>
                  <div className="space-y-3">
                    <ActionButton
                      icon={Plus}
                      label="Add New Product"
                      color="bg-primary"
                      onClick={() => {
                        setActiveTab('products');
                        setShowAddProduct(true);
                        setEditingProduct(null);
                      }}
                    />
                    <ActionButton icon={Download} label="Export Sales Report" color="bg-gray-900" onClick={() => setActiveTab('sales-reports')} />
                    <ActionButton
                      icon={Filter}
                      label="Manage Inventory"
                      color="bg-gray-100 text-gray-800"
                      onClick={() => {
                        logAdminAction(AdminAction.SETTINGS_UPDATE, 'Admin clicked Manage Inventory');
                      }}
                    />
                  </div>
                  <div className="mt-8">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Stock Alerts</h4>
                    <div className="space-y-4">
                      <StockAlert product="iPhone 15 Pro" stock={2} />
                      <StockAlert product="Sony Headphones" stock={5} />
                      <StockAlert product="Nike Shoes" stock={0} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Recent Orders</h3>
                  <button onClick={() => setActiveTab('orders')} className="text-sm font-bold text-primary hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Order ID</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <OrderRow id="#ORD-9842" customer="Rahul Sharma" date="May 12, 2024" amount="₹42,500" status="delivered" />
                      <OrderRow id="#ORD-9841" customer="Priya Singh" date="May 12, 2024" amount="₹1,200" status="shipped" />
                      <OrderRow id="#ORD-9840" customer="Amit Patel" date="May 11, 2024" amount="₹12,499" status="pending" />
                      <OrderRow id="#ORD-9839" customer="Sneha Kapur" date="May 10, 2024" amount="₹3,450" status="processing" />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'sales-reports' && <ReportsView type="sales" />}
          {activeTab === 'payment-reports' && <ReportsView type="payment" />}
          {activeTab === 'activity-logs' && <ActivityLogsView />}
          {activeTab === 'user-roles' && <UserManagementView />}
          {activeTab === 'products' && (
            showAddProduct ? (
              <AddProductView
                product={editingProduct}
                onDelete={handleDeleteProduct}
                onClose={() => {
                  setShowAddProduct(false);
                  setEditingProduct(null);
                }}
              />
            ) : (
              <ProductManagementView
                onAddProduct={() => {
                  setEditingProduct(null);
                  setShowAddProduct(true);
                }}
                onEditProduct={(p) => {
                  setEditingProduct(p);
                  setShowAddProduct(true);
                }}
                onDeleteProduct={handleDeleteProduct}
              />
            )
          )}

          {activeTab === 'orders' && <OrdersManagementView selectedOrder={selectedOrder} setSelectedOrder={setSelectedOrder} setActiveTab={setActiveTab} />}
          {activeTab === 'order-details' && selectedOrder && <AdminOrderDetailsView order={selectedOrder} onBack={() => setActiveTab('orders')} />}
          {activeTab === 'returns' && <ReturnManagementView />}
          {activeTab === 'customers' && <CustomersManagementView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'banners' && <BannersManagementView />}
          {activeTab === 'categories' && <CategoriesManagementView />}
          {activeTab === 'coupons' && <CouponsManagementView />}
          {activeTab === 'reviews' && <ReviewsManagementView />}
          {activeTab === 'vendors' && <VendorsManagementView />}
          {activeTab === 'announcements' && <AnnouncementsManagementView />}

          {(activeTab !== 'dashboard' && activeTab !== 'sales-reports' && activeTab !== 'payment-reports' && activeTab !== 'activity-logs' && activeTab !== 'user-roles' && activeTab !== 'products' && activeTab !== 'orders' && activeTab !== 'customers' && activeTab !== 'analytics' && activeTab !== 'settings' && activeTab !== 'banners' && activeTab !== 'coupons' && activeTab !== 'reviews' && activeTab !== 'vendors' && activeTab !== 'announcements') && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <PieChart className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-800">Coming Soon</h3>
              <p className="text-gray-500">The {activeTab} module is currently under development.</p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="mt-6 text-primary font-bold hover:underline"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active
          ? 'bg-primary text-white shadow-lg shadow-blue-100'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        }`}
    >
      <Icon className="w-5 h-5" />
      <span className="truncate">{label}</span>
      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
    </button>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-xl font-bold transition-transform active:scale-95 ${color} ${color.includes('bg-white') || color.includes('bg-gray-100') ? '' : 'text-white'}`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function ReportsView({ type }: { type: 'sales' | 'payment' }) {
  const [dateRange, setDateRange] = useState('7d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Failed to load orders for reports:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Aggregate real orders by date for salesData
  const salesMap: Record<string, { date: string; amount: number; orders: number; items: number }> = {};
  
  orders.forEach(order => {
    if (!order.createdAt) return;
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const itemsCount = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    
    if (salesMap[dateStr]) {
      salesMap[dateStr].amount += order.total || 0;
      salesMap[dateStr].orders += 1;
      salesMap[dateStr].items += itemsCount;
    } else {
      salesMap[dateStr] = {
        date: dateStr,
        amount: order.total || 0,
        orders: 1,
        items: itemsCount
      };
    }
  });

  const salesData = Object.values(salesMap);

  const paymentData = orders.map(order => {
    const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';

    return {
      id: order.id ? (order.id.startsWith('ORD-') ? order.id : `PAY-${order.id.slice(-6).toUpperCase()}`) : 'N/A',
      customer: order.contactName || order.contactEmail || 'Guest Customer',
      method: order.paymentMethod ? (order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod.toUpperCase()) : 'Unknown',
      status: order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'failed' ? 'failed' : 'pending',
      amount: `₹${(order.total || 0).toLocaleString()}`,
      date: formattedDate
    };
  });

  const exportToCSV = () => {
    const data = type === 'sales' ? salesData : paymentData;
    if (data.length === 0) {
      toast.error('No transactions available to export');
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type}_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAdminAction(
      AdminAction.EXPORT_REPORT,
      `Exported ${type} report for ${dateRange} period.`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{type === 'sales' ? 'Sales Analytics Report' : 'Payment Transaction Report'}</h2>
          <p className="text-sm text-gray-500">Detailed breakdown of {type} metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <FilterBtn active={dateRange === '7d'} onClick={() => setDateRange('7d')}>7 Days</FilterBtn>
            <FilterBtn active={dateRange === '30d'} onClick={() => setDateRange('30d')}>30 Days</FilterBtn>
            <FilterBtn active={dateRange === '90d'} onClick={() => setDateRange('90d')}>90 Days</FilterBtn>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportStat label={type === 'sales' ? 'Total Volume' : 'Net Payments'} value={type === 'sales' ? '₹0' : '₹0'} icon={TrendingUp} color="text-blue-500" />
        <ReportStat label={type === 'sales' ? 'Avg. Basket Size' : 'Successful Payouts'} value={type === 'sales' ? '₹0' : '0%'} icon={PieChart} color="text-primary" />
        <ReportStat label={type === 'sales' ? 'New Customers' : 'Pending Approvals'} value={type === 'sales' ? '0' : '₹0'} icon={Users} color="text-blue-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold">Detailed Data View</h3>
        </div>
        <div className="overflow-x-auto">
          {type === 'sales' ? (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Revenue</th>
                  <th className="px-6 py-4">Orders</th>
                  <th className="px-6 py-4">Items Sold</th>
                  <th className="px-6 py-4">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-medium">Loading sales data...</td>
                  </tr>
                ) : salesData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-medium">No sales transactions recorded yet.</td>
                  </tr>
                ) : (
                  salesData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium">{row.date}</td>
                      <td className="px-6 py-4 text-sm font-bold">₹{row.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">{row.orders}</td>
                      <td className="px-6 py-4 text-sm">{row.items}</td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-500">+{Math.floor(Math.random() * 10)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Trans ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-medium">Loading transactions...</td>
                  </tr>
                ) : paymentData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-medium">No payment transactions recorded yet.</td>
                  </tr>
                ) : (
                  paymentData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-700">{row.id}</td>
                      <td className="px-6 py-4 text-sm font-medium">{row.customer}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-300" />
                          {row.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{row.date}</td>
                      <td className="px-6 py-4 text-sm font-bold">{row.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${row.status === 'success' ? 'bg-blue-100 text-blue-600' :
                            row.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FilterBtn({ children, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}

function ReportStat({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
    </div>
  );
}

function ActivityLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const q = query(
      collection(db, 'adminLogs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adminLogs');
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Admin Activity Logs</h2>
        <p className="text-sm text-gray-500">Real-time audit trail of administrative actions</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">No activity logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">{log.adminEmail}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-tight">ID: {log.adminId.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function StockAlert({ product, stock }: { product: string, stock: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{product}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stock === 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
        {stock === 0 ? 'Out of Stock' : `${stock} Left`}
      </span>
    </div>
  );
}

function OrderRow({ id, customer, date, amount, status }: any) {
  const statusStyles: any = {
    delivered: 'bg-blue-100 text-blue-600',
    shipped: 'bg-primary/10 text-primary',
    pending: 'bg-amber-100 text-amber-600',
    processing: 'bg-purple-100 text-purple-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 text-sm font-bold text-gray-700">{id}</td>
      <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer}</td>
      <td className="px-6 py-4 text-sm text-gray-500">{date}</td>
      <td className="px-6 py-4 text-sm font-bold text-gray-900">{amount}</td>
      <td className="px-6 py-4">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusStyles[status]}`}>
          {status}
        </span>
      </td>
      <td className="px-6 py-4">
        <button className="text-gray-400 hover:text-gray-600">
          <MoreVertical className="w-5 h-5" />
        </button>
      </td>
    </tr>
  );
}

function UserManagementView() {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setSearchEmail(''); // Reset search when filter changes
    let q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    if (roleFilter !== 'all') {
      q = query(
        collection(db, 'users'),
        where('role', '==', roleFilter),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsersList(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [roleFilter]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim()));
      const snap = await getDocs(q);
      const foundUsers = snap.docs.map(doc => doc.data() as UserProfile);
      setUsersList(foundUsers);
    } catch (err) {
      console.error(err);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (targetUserId: string, newRole: Role) => {
    setUpdating(true);
    const toastId = toast.loading('Updating role...');
    try {
      const userRef = doc(db, 'users', targetUserId);
      const targetUser = usersList.find(u => u.uid === targetUserId);

      await updateDoc(userRef, { role: newRole });

      await logAdminAction(
        AdminAction.USER_ROLE_UPDATE,
        `Changed role of ${targetUser?.email} from ${targetUser?.role} to ${newRole}`,
        targetUserId,
        'users'
      );

      toast.success('User role updated successfully', { id: toastId });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update role', { id: toastId });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">Display and manage system users and their roles</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {searchEmail && (
            <span className="text-xs font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
              Found {usersList.length} results for "{searchEmail}"
            </span>
          )}
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${roleFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              All
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${roleFilter === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Admins
            </button>
            <button
              onClick={() => setRoleFilter('vendor')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${roleFilter === 'vendor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Vendors
            </button>
            <button
              onClick={() => setRoleFilter('customer')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${roleFilter === 'customer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Customers
            </button>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${showCreateForm ? 'bg-gray-100 text-gray-600' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover'}`}
          >
            {showCreateForm ? <><X className="w-4 h-4" /> Cancel Creation</> : <><UserPlus className="w-4 h-4" /> Create New User</>}
          </button>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <input
                type="email"
                placeholder="Search by email..."
                className="bg-gray-50 border-none rounded-xl px-4 py-2 pl-10 pr-10 text-sm w-64 focus:ring-2 focus:ring-primary/20"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              {searchEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchEmail('');
                    setRoleFilter('all'); // Reset filter to show all when clearing search
                  }}
                  className="absolute right-3 top-2.5 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform">Search</button>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CreateUserForm
              onSuccess={() => setShowCreateForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Current Role</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading users...</td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                usersList.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                          {user.displayName?.[0] || user.email?.[0] || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{user.displayName}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${user.role === 'admin' ? 'bg-red-100 text-red-600' :
                          user.role === 'vendor' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-primary font-bold text-xs hover:underline flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" />
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Selection Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-xl font-black text-gray-900 mb-2">Change User Role</h3>
              <p className="text-gray-500 text-sm mb-6">Assign a new role to <span className="font-bold text-gray-900">{selectedUser.email}</span>.</p>

              <div className="space-y-3">
                <RoleOption
                  role="customer"
                  current={selectedUser.role}
                  description="Standard customer account with no special permissions."
                  onClick={() => updateRole(selectedUser.uid, 'customer')}
                />
                <RoleOption
                  role="vendor"
                  current={selectedUser.role}
                  description="Can manage their own products and view their specific orders."
                  onClick={() => updateRole(selectedUser.uid, 'vendor')}
                />
                <RoleOption
                  role="admin"
                  current={selectedUser.role}
                  description="Full access to the admin dashboard and all system settings."
                  onClick={() => updateRole(selectedUser.uid, 'admin')}
                />
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Fine-grained Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map(p => {
                    const isChecked = (selectedUser.permissions || []).includes(p);
                    return (
                      <label key={p} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newPerms = e.target.checked
                              ? [...(selectedUser.permissions || []), p]
                              : (selectedUser.permissions || []).filter(pp => pp !== p);
                            updateDoc(doc(db, 'users', selectedUser.uid), { permissions: newPerms });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-medium text-gray-700">{p.replace(/_/g, ' ')}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6 py-3 text-gray-500 font-bold text-sm hover:text-gray-800 transition-colors"
                disabled={updating}
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RoleOption({ role, current, description, onClick }: { role: Role, current: Role, description: string, onClick: () => void }) {
  const isActive = role === current;
  return (
    <button
      onClick={onClick}
      disabled={isActive}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${isActive
          ? 'border-primary bg-primary/5 opacity-60 cursor-not-allowed'
          : 'border-gray-100 hover:border-primary hover:bg-blue-50'
        }`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-black uppercase tracking-wider">{role}</span>
        {isActive && <Check className="w-4 h-4 text-blue-500" />}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </button>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'customer' as Role
  });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.displayName) return;

    setBusy(true);
    const loadingToast = toast.loading('Creating user profile...');
    try {
      // Check if user already exists
      const q = query(collection(db, 'users'), where('email', '==', formData.email.trim()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        toast.error('A user with this email already exists.', { id: loadingToast });
        setBusy(false);
        return;
      }

      // Generate a temporary ID
      const tempId = `temp_${Date.now()}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`;

      const newUser: UserProfile = {
        uid: tempId,
        email: formData.email.trim(),
        displayName: formData.displayName,
        role: formData.role,
        createdAt: new Date().toISOString(),
        phone: '',
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName)}&background=random`
      };

      await setDoc(doc(db, 'users', tempId), newUser);

      await logAdminAction(
        AdminAction.USER_CREATE,
        `Created new ${formData.role} user: ${formData.email} (DisplayName: ${formData.displayName})`,
        tempId,
        'users'
      );

      toast.success('User document created successfully.', { id: loadingToast });
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create user profile.', { id: loadingToast });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-900">Create New User</h3>
          <p className="text-gray-500 text-sm">Assign initial role and basic details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Email Address</label>
          <input
            type="email"
            required
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:border-primary/20 focus:bg-white transition-all outline-none"
            placeholder="user@example.com"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Full Name</label>
          <input
            type="text"
            required
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 text-sm focus:border-primary/20 focus:bg-white transition-all outline-none"
            placeholder="Jane Doe"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Initial Role</label>
          <div className="flex gap-1 h-[46px]">
            {(['customer', 'vendor', 'admin'] as Role[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, role }))}
                className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 transition-all ${formData.role === role
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="bg-gray-900 text-white rounded-2xl h-[46px] font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-100 hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          {busy ? 'Creating...' : (
            <>
              <Check className="w-4 h-4" />
              Create User
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function ProductManagementView({ onAddProduct, onEditProduct, onDeleteProduct }: {
  onAddProduct?: () => void,
  onEditProduct?: (p: Product) => void,
  onDeleteProduct?: (id: string, name: string) => Promise<boolean>
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [editingVariant, setEditingVariant] = useState<{ productId: string, variantId: string, name: string, material: string, price: number, stock: number } | null>(null);
  const [addingVariantTo, setAddingVariantTo] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState({ name: '', material: '', price: 0, stock: 0 });

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleAddVariant = async (productId: string) => {
    if (!newVariant.name) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const toastId = toast.loading('Adding variant...');
    try {
      const v: ProductVariant = {
        id: window.crypto.randomUUID().replace(/-/g, '').slice(0, 9),
        name: newVariant.name,
        material: newVariant.material,
        price: newVariant.price,
        stock: newVariant.stock
      };

      const updatedVariants = [...(product.variants || []), v];
      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Added new variant "${v.name}" to product: ${product.name}`,
        productId,
        'products'
      );

      toast.success('Variant added', { id: toastId });
      setNewVariant({ name: '', extraPrice: 0, stock: 0 });
      setAddingVariantTo(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add variant', { id: toastId });
    }
  };

  const handleUpdateVariant = async (productId: string, variantId: string) => {
    if (!editingVariant) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const toastId = toast.loading('Updating variant...');
    try {
      const updatedVariants = (product.variants || []).map(v =>
        v.id === variantId ? { ...v, name: editingVariant.name, material: editingVariant.material, price: editingVariant.price, stock: editingVariant.stock } : v
      );

      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Updated variant "${editingVariant.name}" for product: ${product.name}`,
        productId,
        'products'
      );

      toast.success('Variant updated successfully', { id: toastId });
      setEditingVariant(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update variant', { id: toastId });
    }
  };

  const handleQuickStockUpdate = async (productId: string, variantId: string, newStock: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants?.find(v => v.id === variantId);
    if (!variant || variant.stock === newStock) return;

    try {
      const updatedVariants = (product.variants || []).map(v =>
        v.id === variantId ? { ...v, stock: newStock } : v
      );

      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Directly updated stock for variant "${variant.name}" (Product: ${product.name}) to ${newStock}`,
        productId,
        'products'
      );

      toast.success('Stock updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update stock');
    }
  };

  const handleDeleteVariant = async (productId: string, variantId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants?.find(v => v.id === variantId);
    if (!variant) return;

    if (!window.confirm(`Delete variant "${variant.name}"?`)) return;

    const toastId = toast.loading('Deleting variant...');
    try {
      const updatedVariants = (product.variants || []).filter(v => v.id !== variantId);
      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        updatedAt: new Date().toISOString()
      });

      try {
        await logAdminAction(
          AdminAction.PRODUCT_UPDATE,
          `Deleted variant "${variant.name}" from product: ${product.name}`,
          productId,
          'products'
        );
      } catch (logErr) {
        console.warn('Logging failed but variant deletion succeeded:', logErr);
      }

      toast.success('Variant deleted successfully', { id: toastId });
    } catch (err) {
      console.error('Variant deletion failed:', err);
      toast.error('Failed to delete variant: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId });
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventory & Variants</h2>
          <p className="text-sm text-gray-500">Manage product stock and variants in detail</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onAddProduct}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Total Stock</th>
                <th className="px-6 py-4">Variants Count</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No products found.</td></tr>
              ) : products.map(product => {
                const isExpanded = expandedProducts.includes(product.id);
                return (
                  <React.Fragment key={product.id}>
                    <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''}`} onClick={() => toggleExpand(product.id)}>
                      <td className="px-6 py-4">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={product.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <span className={product.stock <= 5 ? "text-red-500 font-bold" : "text-gray-700"}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                          {product.variants?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${product.stock > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProduct?.(product);
                            }}
                            className="p-1 text-gray-400 hover:text-primary transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onDeleteProduct) {
                                await onDeleteProduct(product.id, product.name);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={5} className="px-8 py-6">
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                              <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Variants Table</h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddingVariantTo(addingVariantTo === product.id ? null : product.id);
                                  setNewVariant({ name: '', material: '', price: product.price, stock: 0 });
                                }}
                                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline transition-colors ${addingVariantTo === product.id ? 'text-red-500' : 'text-primary'}`}
                              >
                                {addingVariantTo === product.id ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Quick Add</>}
                              </button>
                            </div>
                            <table className="w-full text-left bg-white">
                              <thead className="bg-gray-50/50 text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                                <tr>
                                  <th className="px-6 py-3">Variant Name</th>
                                  <th className="px-6 py-3">Material</th>
                                  <th className="px-6 py-3">Price</th>
                                  <th className="px-6 py-3">Stock</th>
                                  <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {addingVariantTo === product.id && (
                                  <tr className="bg-primary/5">
                                    <td className="px-6 py-3">
                                      <input
                                        autoFocus
                                        placeholder="XL / Red"
                                        className="w-full bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.name}
                                        onChange={e => setNewVariant(p => ({ ...p, name: e.target.value }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        placeholder="Cotton"
                                        className="w-full bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.material}
                                        onChange={e => setNewVariant(p => ({ ...p, material: e.target.value }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">₹</span>
                                        <input
                                          type="number"
                                          className="w-20 bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                          value={newVariant.price}
                                          onChange={e => setNewVariant(p => ({ ...p, price: Number(e.target.value) }))}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        type="number"
                                        className="w-20 bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.stock}
                                        onChange={e => setNewVariant(p => ({ ...p, stock: Number(e.target.value) }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                      <button
                                        onClick={() => handleAddVariant(product.id)}
                                        disabled={!newVariant.name}
                                        className="bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                    </td>
                                  </tr>
                                )}
                                {(!product.variants || product.variants.length === 0) && addingVariantTo !== product.id ? (
                                  <tr>
                                    <td colSpan={5} className="px-6 py-6 text-center text-xs text-gray-400 italic">
                                      No variants configured for this product.
                                    </td>
                                  </tr>
                                ) : (
                                  product.variants.map(variant => {
                                    const isEditing = editingVariant?.variantId === variant.id;
                                    return (
                                      <tr key={variant.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              className="w-full bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.name || ''}
                                              onChange={e => setEditingVariant(p => p ? { ...p, name: e.target.value } : null)}
                                            />
                                          ) : (
                                            <span className="text-xs font-bold text-gray-700">{variant.name}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              className="w-full bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.material || ''}
                                              onChange={e => setEditingVariant(p => p ? { ...p, material: e.target.value } : null)}
                                            />
                                          ) : (
                                            <span className="text-xs text-gray-500">{variant.material || '-'}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-gray-400">₹</span>
                                              <input
                                                type="number"
                                                className="w-20 bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                                value={editingVariant.price || 0}
                                                onChange={e => setEditingVariant(p => p ? { ...p, price: Number(e.target.value) } : null)}
                                              />
                                            </div>
                                          ) : (
                                            <span className="text-xs font-bold text-blue-600">₹{(variant.price || 0).toLocaleString()}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              className="w-20 bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.stock || 0}
                                              onChange={e => setEditingVariant(p => p ? { ...p, stock: Number(e.target.value) } : null)}
                                            />
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                defaultValue={variant.stock}
                                                key={`${product.id}-${variant.id}-${variant.stock}`}
                                                onBlur={(e) => handleQuickStockUpdate(product.id, variant.id, Number(e.target.value))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleQuickStockUpdate(product.id, variant.id, Number((e.target as HTMLInputElement).value));
                                                    (e.target as HTMLInputElement).blur();
                                                  }
                                                }}
                                                className={`w-20 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-primary/20 outline-none transition-all ${variant.stock <= 5 ? 'text-red-500 border-red-100' : 'text-gray-700'}`}
                                              />
                                              {variant.stock <= 5 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                              <>
                                                <button onClick={() => setEditingVariant(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleUpdateVariant(product.id, variant.id)} className="p-1.5 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingVariant({ productId: product.id, variantId: variant.id, name: variant.name || '', material: variant.material || '', price: variant.price || 0, stock: variant.stock });
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                                                >
                                                  <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteVariant(product.id, variant.id);
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function OrdersManagementView({ selectedOrder, setSelectedOrder, setActiveTab }: { selectedOrder: Order | null, setSelectedOrder: (o: Order | null) => void, setActiveTab: (t: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<'createdAt' | 'total' | 'contactName'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [trackingForm, setTrackingForm] = useState({ trackingId: '', carrier: '', estimatedDelivery: '' });

  useEffect(() => {
    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    if (filter !== 'all') {
      q = query(collection(db, 'orders'), where('status', '==', filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

      // Filter
      if (searchQuery) {
        data = data.filter(o =>
          o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Sort
      data.sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (sortBy === 'createdAt') {
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
        } else if (sortBy === 'contactName') {
          valA = a.contactName?.toLowerCase();
          valB = b.contactName?.toLowerCase();
        }

        if (sortDirection === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });

      setOrders(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [filter, searchQuery, sortBy, sortDirection]);

  const updateOrderStatus = async (orderId: string, status: OrderStatus, message?: string, location?: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newHistoryItem = {
        status,
        timestamp: new Date().toISOString(),
        message: message || `Order status updated to ${status.replace('_', ' ')}`,
        location: location || "Logistics Center"
      };

      await updateDoc(orderRef, {
        status,
        statusHistory: arrayUnion(newHistoryItem)
      });

      await logAdminAction(AdminAction.SETTINGS_UPDATE, `Updated Order #${orderId} status to ${status}`, orderId, 'orders');
      toast.success(`Order ${status.replace('_', ' ')} successfully`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update order status');
    }
  };

  const updateTrackingInfo = async (orderId: string, form: any) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const trackingMsg = `Order shipped via ${form.carrier}. Tracking ID: ${form.trackingId}`;
      const newHistoryItem = {
        status: 'shipped',
        timestamp: new Date().toISOString(),
        message: trackingMsg,
        location: "Logistics Center"
      };

      await updateDoc(orderRef, {
        ...form,
        status: 'shipped',
        statusHistory: arrayUnion(newHistoryItem),
        updatedAt: new Date().toISOString()
      });

      await logAdminAction(AdminAction.SETTINGS_UPDATE, `Added tracking for Order #${orderId}: ${form.carrier} (${form.trackingId})`, orderId, 'orders');
      toast.success('Tracking information updated and order shipped');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update tracking');
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const statusStyles: any = {
    pending: 'bg-amber-100 text-amber-600',
    accepted: 'bg-blue-100 text-blue-600',
    shipped: 'bg-purple-100 text-purple-600',
    pickup_ready: 'bg-indigo-100 text-indigo-600',
    fulfilled: 'bg-green-100 text-green-600',
    cancelled: 'bg-gray-100 text-gray-600',
    rejected: 'bg-red-100 text-red-600',
  };

  const statusOptions: (OrderStatus | 'all')[] = ['all', 'pending', 'accepted', 'shipped', 'pickup_ready', 'fulfilled', 'cancelled', 'rejected'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-6 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Order Management</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage, track and fulfill customer orders</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 pl-10 text-xs w-64 focus:ring-2 focus:ring-primary/20 font-bold"
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 w-32 outline-none"
              >
                <option value="createdAt">Sort: Date</option>
                <option value="total">Sort: Total</option>
                <option value="contactName">Sort: Customer</option>
              </select>
              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
            </div>
            <button className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filter === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-black text-gray-400 tracking-[0.15em]">
              <tr>
                <th className="px-8 py-5">Order Info</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5">Value</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-black uppercase tracking-widest">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-black uppercase tracking-widest">No orders found</td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className="group hover:bg-gray-50/50 transition-all">
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-gray-900 tracking-tight">#{order.id.slice(-8).toUpperCase()}</span>
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{order.contactName}</span>
                      <span className="text-xs text-gray-500 font-medium">{order.contactEmail}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900">₹{order.total.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{order.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest ${statusStyles[order.status]}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setActiveTab('order-details');
                        }}
                        className="p-3 bg-white border border-gray-100 text-gray-400 rounded-xl hover:text-primary hover:border-primary/20 hover:shadow-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <div className="h-6 w-px bg-gray-100 mx-1" />

                      {/* Status Transitions */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'accepted')}
                          className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20"
                        >
                          Accept
                        </button>
                      )}
                      {order.status === 'accepted' && (
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setTrackingForm({
                              trackingId: order.trackingId || '',
                              carrier: order.carrier || '',
                              estimatedDelivery: order.estimatedDelivery || ''
                            });
                            setShowTrackingModal(true);
                          }}
                          className="px-4 py-2 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-100"
                        >
                          Ship
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'pickup_ready')}
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                        >
                          Ready
                        </button>
                      )}
                      {order.status === 'pickup_ready' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'fulfilled')}
                          className="px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-700 shadow-lg shadow-green-100"
                        >
                          Fulfill
                        </button>
                      )}

                      {(order.status === 'pending' || order.status === 'accepted') && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'rejected')}
                          className="p-3 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showTrackingModal && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTrackingModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h3 className="text-xl font-black text-gray-900 mb-2">Update Tracking</h3>
              <p className="text-sm text-gray-400 mb-6 font-medium">Order #{selectedOrder.id.slice(-6).toUpperCase()}</p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Tracking ID</label>
                  <input
                    value={trackingForm.trackingId}
                    onChange={e => setTrackingForm({ ...trackingForm, trackingId: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white outline-none"
                    placeholder="TRK123456789"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Carrier</label>
                  <input
                    value={trackingForm.carrier}
                    onChange={e => setTrackingForm({ ...trackingForm, carrier: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white outline-none"
                    placeholder="BlueDart, Delhivery, etc."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Est. Delivery</label>
                  <input
                    type="date"
                    value={trackingForm.estimatedDelivery}
                    onChange={e => setTrackingForm({ ...trackingForm, estimatedDelivery: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowTrackingModal(false)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">Cancel</button>
                <button
                  onClick={() => {
                    updateTrackingInfo(selectedOrder.id, trackingForm);
                    setShowTrackingModal(false);
                  }}
                  className="flex-2 bg-primary text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                  Update Info
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDetailModal && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetailModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-0 max-w-2xl w-full relative z-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Order Confirmation</h3>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">#{selectedOrder.id.toUpperCase()}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-3 hover:bg-white rounded-2xl transition-colors text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-100">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Contact Information</h4>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-gray-900">{selectedOrder.contactName}</p>
                      <p className="text-xs text-gray-500 font-medium">{selectedOrder.contactEmail}</p>
                      <p className="text-xs text-gray-500 font-medium">{selectedOrder.contactPhone}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Delivery Address</h4>
                    <p className="text-xs text-gray-500 font-bold leading-relaxed">
                      {selectedOrder.address.street},<br />
                      {selectedOrder.address.city}, {selectedOrder.address.state} - {selectedOrder.address.zip}<br />
                      {selectedOrder.address.country}
                    </p>
                  </div>
                </div>

                {selectedOrder.trackingId && (
                  <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-2xl shadow-sm text-purple-600">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Tracking Information</p>
                        <p className="text-sm font-black text-purple-700 mt-1">{selectedOrder.carrier}: {selectedOrder.trackingId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Est. Delivery</p>
                      <p className="text-sm font-black text-purple-700 mt-1">
                        {selectedOrder.estimatedDelivery ? new Date(selectedOrder.estimatedDelivery).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Order Items</h4>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex gap-5 p-4 bg-gray-50 rounded-[2rem] border border-gray-100 group hover:bg-white hover:shadow-xl hover:shadow-gray-100 transition-all duration-500">
                        <img src={item.image} className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-sm" alt="" />
                        <div className="flex-1 min-w-0 self-center">
                          <p className="text-sm font-black text-gray-900 truncate tracking-tight">{item.name}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Quantity: {item.quantity} × ₹{item.price.toLocaleString()}</p>
                        </div>
                        <div className="text-sm font-black text-gray-900 self-center bg-white px-4 py-2 rounded-xl shadow-sm">₹{(item.price * item.quantity).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Payment Method</p>
                      <p className="text-lg font-black uppercase tracking-tight">{selectedOrder.paymentMethod}</p>
                      <p className="text-[10px] font-black uppercase mt-1 px-2 py-0.5 bg-white/10 rounded inline-block">{selectedOrder.paymentStatus}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Total Paid</p>
                      <p className="text-4xl font-black tracking-tighter">₹{selectedOrder.total.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-gray-100 flex gap-4 bg-gray-50/30">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 py-5 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-gray-200 hover:bg-black transition-all active:scale-95"
                >
                  Close View
                </button>
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'processing');
                      setShowDetailModal(false);
                    }}
                    className="flex-1 bg-primary text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-95"
                  >
                    Approve Order
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CustomersManagementView() {
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'customer'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers Directory</h2>
          <p className="text-sm text-gray-500">View and manage your registered customer base</p>
        </div>
        <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
          <span className="text-xs font-black text-primary uppercase tracking-widest">{customers.length} Total Customers</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center">
              <tr>
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Addresses</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-medium">Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-medium">No customers found.</td></tr>
              ) : customers.map(customer => (
                <tr key={customer.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black uppercase">
                        {customer.displayName?.[0] || customer.email?.[0] || 'C'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{customer.displayName}</span>
                        <span className="text-xs text-gray-500">{customer.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-medium text-gray-600">{customer.phone || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-black bg-gray-100 px-2 py-1 rounded-lg uppercase tracking-widest text-gray-500">
                      {customer.addresses?.length || (customer.address ? 1 : 0)} Saved
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 text-center">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="text-primary hover:bg-primary/5 p-2 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="text-gray-400 hover:text-primary p-2 rounded-lg transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedCustomer && (
          <CustomerDetailModal
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CustomerDetailModal({ customer, onClose }: { customer: UserProfile, onClose: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const q = query(collection(db, 'orders'), where('customerId', '==', customer.uid), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      } catch (err) {
        console.error('Error fetching customer orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [customer.uid]);

  const totalSpent = orders.reduce((sum, order) => sum + (order.paymentStatus === 'paid' ? order.total : 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-0 max-w-2xl w-full relative z-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xl uppercase">
              {customer.displayName?.[0] || customer.email?.[0] || 'C'}
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">{customer.displayName}</h3>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{customer.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-colors text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Orders</p>
              <p className="text-2xl font-black text-gray-900">{orders.length}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Spent</p>
              <p className="text-2xl font-black text-primary">₹{totalSpent.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Loyalty Tier</p>
              <p className="text-2xl font-black text-amber-600 italic">
                {totalSpent > 10000 ? 'Platinum' : totalSpent > 5000 ? 'Gold' : 'Standard'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6">Saved Delivery Nodes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customer.addresses?.map((addr, idx) => (
                <div key={idx} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <p className="text-sm font-black text-gray-900">{addr.street}</p>
                    <p className="text-xs text-gray-500 font-medium">{addr.city}, {addr.state} - {addr.zip}</p>
                  </div>
                </div>
              ))}
              {customer.address && !customer.addresses?.some(a => a.zip === customer.address?.zip) && (
                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <p className="text-sm font-black text-gray-900">{customer.address.street}</p>
                    <p className="text-xs text-gray-500 font-medium">{customer.address.city}, {customer.address.state} - {customer.address.zip}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6">Recent Activity (Orders)</h4>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-gray-400 italic">Loading history...</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-10 bg-gray-50 rounded-3xl">No historical transactions detected.</p>
              ) : orders.map(order => (
                <div key={order.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-[2rem] border border-gray-100 group hover:bg-white hover:shadow-xl transition-all duration-500">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-gray-900 tracking-tight">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">₹{order.total.toLocaleString()}</p>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${order.status === 'fulfilled' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50/30">
          <button
            onClick={onClose}
            className="w-full py-5 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-gray-200 hover:bg-black transition-all active:scale-95"
          >
            Close Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsView() {
  const [config, setConfig] = useState({
    siteName: 'Antigravity Store',
    logoUrl: 'https://cdn-icons-png.flaticon.com/512/3649/3649265.png',
    supportEmail: 'support@antigravity.com',
    currency: 'INR',
    taxRate: 18,
    notificationEmails: true,
  });

  const saveSettings = () => {
    toast.success('Settings saved successfully');
    logAdminAction(AdminAction.SETTINGS_UPDATE, 'Updated system settings');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-500">Configure global application behavior</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Store Name</label>
          <input
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
            value={config.siteName}
            onChange={e => setConfig(prev => ({ ...prev, siteName: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Logo URL</label>
          <input
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
            value={config.logoUrl}
            onChange={e => setConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Support Email</label>
          <input
            className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
            value={config.supportEmail}
            onChange={e => setConfig(prev => ({ ...prev, supportEmail: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Currency</label>
            <select
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
              value={config.currency}
              onChange={e => setConfig(prev => ({ ...prev, currency: e.target.value }))}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Tax Rate (%)</label>
            <input
              type="number"
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
              value={config.taxRate}
              onChange={e => setConfig(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
          <div>
            <p className="text-sm font-bold text-gray-900">Notification Emails</p>
            <p className="text-xs text-gray-500">Send automated alert emails to admins</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, notificationEmails: !prev.notificationEmails }))}
            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${config.notificationEmails ? 'bg-primary' : 'bg-gray-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${config.notificationEmails ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <button
          onClick={saveSettings}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl shadow-gray-200"
        >
          Save Configuration
        </button>
      </div>
    </motion.div>
  );
}

function AnalyticsView() {
  const data: any[] = [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Advanced Analytics</h2>
        <p className="text-sm text-gray-500">Deep dive into store performance and user behavior</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-gray-800">Revenue vs Orders</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#1e40af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-gray-800">User Acquisition</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Product Image Uploader ───────────────────────────────────────────────────
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;

function ProductImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const MAX_SLOTS = 6;

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const remaining = MAX_SLOTS - images.length;
      const toProcess = Array.from(files).slice(0, remaining);

      toProcess.forEach((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`"${file.name}" is not a supported format (JPG, PNG, WEBP).`);
          return;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          toast.error(`"${file.name}" exceeds the 10 MB limit.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          onChange([...images, dataUrl]);
        };
        reader.readAsDataURL(file);
      });
    },
    [images, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleAddUrl = () => {
    const url = urlValue.trim();
    if (!url) return;

    // Validate image URL pattern to prevent XSS/injection attacks (CodeQL DOM text reinterpreted as HTML)
    const isValid = /^https?:\/\/.+/i.test(url) || /^data:image\/[a-z+]+;base64,.+/i.test(url);
    if (!isValid) {
      toast.error('Please enter a valid HTTP, HTTPS, or Base64 data image URL.');
      return;
    }

    if (images.length >= MAX_SLOTS) {
      toast.error('Maximum 6 images allowed.');
      return;
    }
    onChange([...images, url]);
    setUrlValue('');
    setShowUrlInput(false);
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx: number) => {
    if (idx === 0) return;
    const reordered = [images[idx], ...images.filter((_, i) => i !== idx)];
    onChange(reordered);
  };

  return (
    <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-gray-900 tracking-tight">Product Media Assets</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            JPG · PNG · WEBP — Max 10 MB each
          </p>
        </div>
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${images.length >= MAX_SLOTS
              ? 'bg-red-50 text-red-500 border-red-100'
              : 'bg-gray-50 text-gray-400 border-gray-100'
            }`}
        >
          {images.length}/{MAX_SLOTS} Slots
        </span>
      </div>

      {/* Drop Zone */}
      {images.length < MAX_SLOTS && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative w-full border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 py-14 cursor-pointer transition-all duration-300 group ${isDragging
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : 'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
        >
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-blue-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'
              }`}
          >
            <Upload
              className={`w-7 h-7 transition-colors duration-300 ${isDragging ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-600'
                }`}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-gray-700">
              {isDragging ? 'Drop images here' : 'Drag & drop images here'}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-medium">
              or <span className="text-blue-500 font-black">click to browse</span>
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Animated ring when dragging */}
          {isDragging && (
            <div className="absolute inset-0 rounded-[32px] border-4 border-blue-400/40 animate-pulse pointer-events-none" />
          )}
        </div>
      )}

      {/* Image Thumbnails Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-5">
          {images.map((img, idx) => (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="relative aspect-square bg-gray-50 rounded-[28px] overflow-hidden group border-2 border-transparent hover:border-gray-900 transition-all cursor-pointer"
              onClick={() => setPrimary(idx)}
              title={idx === 0 ? 'Primary image' : 'Click to set as primary'}
            >
              <img
                src={sanitizeImageUrl(img) || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'}
                alt={`Product image ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 rounded-[26px]" />

              {/* Primary Badge */}
              {idx === 0 ? (
                <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                  ★ Primary
                </span>
              ) : (
                <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                  Set Primary
                </span>
              )}

              {/* Delete Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(idx);
                }}
                className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-xl text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Position badge */}
              <span className="absolute top-3 left-3 w-6 h-6 bg-black/40 backdrop-blur-sm text-white text-[9px] font-black rounded-lg flex items-center justify-center">
                {idx + 1}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* URL Fallback */}
      <div className="border-t border-gray-50 pt-6">
        {showUrlInput ? (
          <div className="flex gap-3 items-center">
            <input
              ref={urlInputRef}
              autoFocus
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
              placeholder="https://example.com/product-image.jpg"
              className="flex-1 bg-gray-50 border-2 border-gray-200 focus:border-blue-300 rounded-2xl px-5 py-3 text-sm outline-none transition-all font-medium"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={!urlValue.trim() || images.length >= MAX_SLOTS}
              className="px-5 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-40 whitespace-nowrap"
            >
              Add URL
            </button>
            <button
              type="button"
              onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
              className="p-3 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            disabled={images.length >= MAX_SLOTS}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30"
          >
            <Link2 className="w-3.5 h-3.5" />
            Add via URL instead
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AddProductView({ product, onClose, onDelete }: { product: Product | null, onClose: () => void, onDelete?: (id: string, name: string) => Promise<boolean> }) {
  const { categories } = useCategoryStore();
  const [formData, setFormData] = useState<Partial<Product>>(() => {
    const defaults = {
      name: '',
      brand: '',
      description: '',
      fullDescription: '',
      price: 0,
      mrp: 0,
      discountPercentage: 0,
      gst: 0,
      categoryId: '',
      subCategoryId: '',
      nestedSubCategoryId: '',
      vendorId: 'admin',
      images: [],
      primaryImage: '',
      sku: '',
      tags: [],
      stock: 0,
      status: 'active' as const,
      rating: 5,
      numReviews: 0,
      variants: [],
      features: [],
      serviceablePincodes: [],
      color: '',
      size: '',
      createdAt: new Date().toISOString(),
    };
    if (product) {
      return {
        ...defaults,
        ...product,
        name: product.name || '',
        brand: product.brand || '',
        description: product.description || '',
        fullDescription: product.fullDescription || '',
        primaryImage: product.primaryImage || '',
        sku: product.sku || '',
        color: product.color || '',
        size: product.size || '',
        categoryId: product.categoryId || '',
        subCategoryId: product.subCategoryId || '',
        nestedSubCategoryId: product.nestedSubCategoryId || '',
        variants: (product.variants || []).map(v => ({
          ...v,
          name: v.name || '',
          color: v.color || '',
          size: v.size || '',
          material: v.material || '',
          sku: v.sku || '',
          image: v.image || '',
          price: v.price || 0,
          stock: v.stock || 0,
        })),
        images: product.images || [],
        tags: product.tags || [],
        features: product.features || [],
        serviceablePincodes: product.serviceablePincodes || [],
        price: product.discountPrice !== undefined && product.discountPrice !== null ? product.discountPrice : product.price,
        mrp: product.discountPrice !== undefined && product.discountPrice !== null ? product.price : (product.mrp || product.price),
        stock: product.stock || 0,
        gst: product.gst || 0,
        discountPercentage: product.discountPercentage || 0,
      };
    }
    return defaults;
  });

  const [currentTag, setCurrentTag] = useState('');
  const [busy, setBusy] = useState(false);

  // Set default categoryId once categories load, if none is set
  useEffect(() => {
    if (!formData.categoryId && categories.length > 0) {
      setFormData(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, formData.categoryId]);

  const selectedCategory = categories.find(c => c.id === formData.categoryId);
  const selectedSubCategory = selectedCategory?.subcategories?.find(s => s.id === formData.subCategoryId);

  // Auto-calculate discount
  useEffect(() => {
    const mrp = formData.mrp || 0;
    const price = formData.price || 0;
    let discount = 0;
    if (mrp > 0 && price > 0 && mrp > price) {
      discount = Math.round(((mrp - price) / mrp) * 100);
    }
    if (discount !== formData.discountPercentage) {
      setFormData(prev => ({ ...prev, discountPercentage: discount }));
    }
  }, [formData.mrp, formData.price, formData.discountPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const toastId = toast.loading(product ? 'Synchronizing product update...' : 'Initializing new product record...');

    try {
      const pid = product?.id || `prod_${Date.now()}`;
      const mrp = formData.mrp || 0;
      const price = formData.price || 0;
      const isDiscounted = mrp > 0 && price > 0 && mrp > price;

      const rawData = {
        ...formData,
        id: pid,
        price: isDiscounted ? mrp : price,
        discountPrice: isDiscounted ? price : null,
        mrp: mrp || price,
        discountPercentage: isDiscounted ? Math.round(((mrp - price) / mrp) * 100) : 0,
        updatedAt: new Date().toISOString()
      };

      // Clean undefined values
      const productData: any = {};
      Object.keys(rawData).forEach(key => {
        const value = (rawData as any)[key];
        if (value !== undefined) {
          productData[key] = value;
        }
      });

      await setDoc(doc(db, 'products', pid), productData, { merge: true });
      await logAdminAction(
        product ? AdminAction.PRODUCT_UPDATE : AdminAction.PRODUCT_CREATE,
        `${product ? 'Refined' : 'Deployed'} product: ${formData.name}`,
        pid,
        'products'
      );

      toast.success(product ? 'Systems Updated' : 'Product Deployed', { id: toastId });
      onClose();
    } catch (err) {
      toast.error('Deployment Failed', { id: toastId });
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setBusy(false);
    }
  };

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: `var_${Date.now()}`,
      color: '',
      size: '',
      material: '',
      price: formData.price || 0,
      stock: 0,
      sku: `${formData.sku}_VAR_${formData.variants?.length || 0}`,
      image: formData.primaryImage || ''
    };
    setFormData(prev => ({ ...prev, variants: [...(prev.variants || []), newVariant] }));
  };

  const removeVariant = (id: string) => {
    setFormData(prev => ({ ...prev, variants: prev.variants?.filter(v => v.id !== id) }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto pb-20 space-y-12"
    >
      <div className="flex justify-between items-end border-b border-gray-100 pb-10">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic">
            {product ? 'EDIT_NODE' : 'NEW_ENTITY'}
          </h2>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-[0.2em] mt-2">
            Product Identification {product?.id ? `(${product.id.slice(0, 8)})` : ''}
          </p>
        </div>
        <div className="flex gap-4">
          {product && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const nameToDelete = product.name || formData.name || 'this product';
                if (onDelete) {
                  setBusy(true);
                  const success = await onDelete(product.id, nameToDelete);
                  if (success) onClose();
                  setBusy(false);
                } else {
                  if (window.confirm(`DANGER: Permanently delete "${nameToDelete}"?`)) {
                    setBusy(true);
                    const tid = toast.loading('Deleting...');
                    try {
                      await deleteDoc(doc(db, 'products', product.id));
                      await logAdminAction(AdminAction.PRODUCT_DELETE, `Deleted product from edit view: ${nameToDelete}`, product.id, 'products');
                      toast.success('Product Deleted', { id: tid });
                      onClose();
                    } catch (err) {
                      console.error('Delete from modal failed:', err);
                      toast.error('Failed to delete', { id: tid });
                      handleFirestoreError(err, OperationType.DELETE, `products/${product.id}`);
                    } finally {
                      setBusy(false);
                    }
                  }
                }
              }}
              className="px-8 py-4 bg-red-50 text-red-500 border-2 border-transparent rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Delete Product
            </button>
          )}
          <button onClick={onClose} type="button" className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all">
            Abort Operation
          </button>
          <button type="submit" form="product-form" disabled={busy} className="px-10 py-4 bg-gray-900 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-gray-200 hover:scale-105 active:scale-95 transition-all">
            Save Product
          </button>
        </div>
      </div>

      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Media & Variants */}
        <div className="lg:col-span-2 space-y-12">

          {/* Media Section */}
          <ProductImageUploader
            images={formData.images || []}
            onChange={(imgs) =>
              setFormData(p => ({
                ...p,
                images: imgs,
                primaryImage: imgs[0] ?? p.primaryImage
              }))
            }
          />

          {/* Product Info Section */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-10">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Core Configuration</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Entity Name</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="E.g. Lunar Edition X-1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Brand Signature</label>
                <input
                  value={formData.brand}
                  onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Manufacturer Name"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Internal Digest (Short Description)</label>
                <input
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-bold text-sm"
                  placeholder="Brief architectural summary..."
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Technical Documentation (Full Description)</label>
                <textarea
                  value={formData.fullDescription}
                  onChange={e => setFormData(p => ({ ...p, fullDescription: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[32px] px-8 py-6 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm h-48 resize-none"
                  placeholder="Exhaustive specifications and features..."
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Serviceable Pincodes (Comma separated, empty for nationwide)</label>
                <textarea
                  value={formData.serviceablePincodes?.join(', ') || ''}
                  onChange={e => setFormData(p => ({ ...p, serviceablePincodes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[32px] px-8 py-6 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm h-32 resize-none"
                  placeholder="E.g. 560001, 560064, 110001"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Node Identifier (SKU)</label>
                <input
                  value={formData.sku}
                  onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="SKU-000-X"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Color Palette</label>
                <input
                  maxLength={40}
                  value={formData.color}
                  onChange={e => setFormData(p => ({ ...p, color: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Enter Color (Max 40)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Dimension Matrix</label>
                <input
                  maxLength={50}
                  value={formData.size}
                  onChange={e => setFormData(p => ({ ...p, size: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Enter Size (Max 50)"
                />
              </div>
            </div>
          </div>

          {/* Variant System */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Variant Matrix</h3>
              <button
                type="button"
                onClick={addVariant}
                className="px-6 py-3 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all"
              >
                Append Variant
              </button>
            </div>

            <div className="space-y-6">
              {(formData.variants || []).map((v, idx) => (
                <div key={v.id} className="p-8 bg-gray-50 rounded-[32px] grid grid-cols-2 lg:grid-cols-4 gap-6 items-end relative">
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="absolute -top-3 -right-3 p-3 bg-white text-red-500 rounded-full shadow-lg hover:bg-red-500 hover:text-white transition-all z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Color</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. Red" value={v.color} onChange={e => updateVariant(v.id, 'color', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Size</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. XL" value={v.size} onChange={e => updateVariant(v.id, 'size', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Material</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. Cotton" value={v.material} onChange={e => updateVariant(v.id, 'material', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Individual Price (₹)</label>
                    <input type="number" className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.price} onChange={e => updateVariant(v.id, 'price', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Stock Units</label>
                    <input type="number" className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.stock} onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant SKU</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.sku} onChange={e => updateVariant(v.id, 'sku', e.target.value)} />
                  </div>
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant Specific Asset URL</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.image} onChange={e => updateVariant(v.id, 'image', e.target.value)} />
                  </div>
                </div>
              ))}
              {(!formData.variants || formData.variants.length === 0) && (
                <div className="py-12 text-center text-gray-300 font-bold italic border-2 border-dashed border-gray-100 rounded-[32px]">
                  No sub-variants initialized.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Inventory & Meta */}
        <div className="space-y-12">

          {/* Economy & Pricing */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Economic Model</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Market Retail Price (MRP)</label>
                <input
                  type="number"
                  value={formData.mrp}
                  onChange={e => setFormData(p => ({ ...p, mrp: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-xl italic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Effective Selling Price</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))}
                  className="w-full bg-blue-50/50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-xl italic text-blue-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Discount (%)</label>
                  <div className="w-full bg-gray-50 rounded-[24px] px-8 py-5 font-black text-sm opacity-50">
                    {formData.discountPercentage}%
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Savings (₹)</label>
                  <div className="w-full bg-green-50 text-green-700 rounded-[24px] px-8 py-5 font-black text-sm">
                    ₹{formData.mrp && formData.price && formData.mrp > formData.price ? (formData.mrp - formData.price).toLocaleString() : 0}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">GST/Tax (%)</label>
                  <input
                    type="number"
                    value={formData.gst}
                    onChange={e => setFormData(p => ({ ...p, gst: Number(e.target.value) }))}
                    className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Category */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Logistics & Placement</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Protocol Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                >
                  <option value="active">Active Deployment</option>
                  <option value="draft">Draft Protocol</option>
                  <option value="out_of_stock">Emergency Out-of-Stock</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Inventory Depth</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData(p => ({ ...p, stock: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Primary Collection</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData(p => ({ ...p, categoryId: e.target.value, subCategoryId: '', nestedSubCategoryId: '' }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Sector (Sub-category)</label>
                <select
                  value={formData.subCategoryId}
                  onChange={e => setFormData(p => ({ ...p, subCategoryId: e.target.value, nestedSubCategoryId: '' }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm disabled:opacity-30"
                  disabled={!selectedCategory?.subcategories || selectedCategory.subcategories.length === 0}
                >
                  <option value="">Select Sector</option>
                  {selectedCategory?.subcategories?.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
              {selectedSubCategory?.subcategories && selectedSubCategory.subcategories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Nested Sub-category</label>
                  <select
                    value={formData.nestedSubCategoryId}
                    onChange={e => setFormData(p => ({ ...p, nestedSubCategoryId: e.target.value }))}
                    className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  >
                    <option value="">Select Nested Sub-category</option>
                    {selectedSubCategory.subcategories.map(nested => <option key={nested.id} value={nested.id}>{nested.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
 
          {/* Tags & Search */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Keywords / Search Tags</h3>
            <div className="space-y-4">
              <textarea
                value={formData.tags?.join(', ') || ''}
                onChange={e => {
                  const tagsVal = e.target.value;
                  const tagsArray = tagsVal.split(',').map(t => t.trim()).filter(Boolean);
                  setFormData(p => ({ ...p, tags: tagsArray }));
                }}
                className="w-full bg-gray-50 border-4 border-transparent rounded-[32px] px-8 py-6 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm h-32 resize-none"
                placeholder="apple, iphone, ios, mobile, smartphone"
              />
              <p className="text-[10px] text-gray-400 font-bold ml-1">Keywords separated by commas. These keywords help customers locate products via searching.</p>
            </div>
            
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                {formData.tags.map(tag => (
                  <span key={tag} className="px-4 py-2 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary/5 flex items-center gap-2">
                    {tag}
                    <button type="button" onClick={() => setFormData(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))} className="text-primary/40 hover:text-primary"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
 
        </div>
      </form>
    </motion.div>
  );
}

function CategoriesManagementView() {
  const { categories } = useCategoryStore();
  const [busy, setBusy] = useState(false);

  // Expandable tree state
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  const toggleCat = (id: string) => setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleSub = (catId: string, subId: string) => {
    const id = `${catId}-${subId}`;
    setExpandedSubs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Add category state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('sparkles');

  // Edit category state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatImage, setEditCatImage] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('sparkles');

  // Add subcategory state
  const [activeAddSubCatId, setActiveAddSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubImage, setNewSubImage] = useState('');

  // Edit subcategory state
  const [editingSubId, setEditingSubId] = useState<{ catId: string; subId: string } | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubImage, setEditSubImage] = useState('');

  // Add nested subcategory state
  const [activeAddNestedId, setActiveAddNestedId] = useState<{ catId: string; subId: string } | null>(null);
  const [newNestedName, setNewNestedName] = useState('');
  const [newNestedImage, setNewNestedImage] = useState('');

  // Edit nested subcategory state
  const [editingNestedId, setEditingNestedId] = useState<{ catId: string; subId: string; nestedId: string } | null>(null);
  const [editNestedName, setEditNestedName] = useState('');
  const [editNestedImage, setEditNestedImage] = useState('');

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const catId = newCatName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    setBusy(true);
    try {
      const newCat = {
        id: catId,
        name: newCatName.trim(),
        image: newCatImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400',
        icon: newCatIcon || 'sparkles',
        subcategories: []
      };
      await setDoc(doc(db, 'categories', catId), newCat);
      toast.success('Category added successfully');
      setNewCatName('');
      setNewCatImage('');
      setNewCatIcon('sparkles');
      setShowAddCat(false);
    } catch (e) {
      toast.error('Failed to add category');
    } finally {
      setBusy(false);
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatImage(cat.image);
    setEditCatIcon(cat.icon || 'sparkles');
  };

  const saveEditCategory = async (catId: string) => {
    if (!editCatName.trim()) {
      toast.error('Category name is required');
      return;
    }
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      await setDoc(doc(db, 'categories', catId), {
        ...cat,
        name: editCatName.trim(),
        image: editCatImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400',
        icon: editCatIcon
      });
      toast.success('Category updated successfully');
      setEditingCatId(null);
    } catch (e: any) {
      toast.error('Failed to update category: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const updateCategoryImage = async (catId: string, newImage: string) => {
    if (!newImage) return;
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if(!cat) return;
      await setDoc(doc(db, 'categories', catId), { ...cat, image: newImage });
      toast.success('Category image updated');
    } catch (e: any) {
      toast.error(`Failed to update image: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  const deleteCategory = async (catId: string) => {
    if (!window.confirm('Are you sure you want to delete this category? All subcategories and nested subcategories will be permanently deleted!')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'categories', catId));
      toast.success('Category deleted');
    } catch (e) {
      toast.error('Failed to delete category');
    } finally {
      setBusy(false);
    }
  };

  const addSubcategory = async (e: React.FormEvent, catId: string) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const subId = newSubName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const newSub = {
        id: subId,
        name: newSubName.trim(),
        image: newSubImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400',
        subcategories: []
      };
      const subcategories = cat.subcategories ? [...cat.subcategories, newSub] : [newSub];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Subcategory added successfully');
      setNewSubName('');
      setNewSubImage('');
      setActiveAddSubCatId(null);
    } catch (e) {
      toast.error('Failed to add subcategory');
    } finally {
      setBusy(false);
    }
  };

  const startEditSubcategory = (catId: string, sub: SubCategory) => {
    setEditingSubId({ catId, subId: sub.id });
    setEditSubName(sub.name);
    setEditSubImage(sub.image || '');
  };

  const saveEditSubcategory = async (catId: string, subId: string) => {
    if (!editSubName.trim()) {
      toast.error('Subcategory name is required');
      return;
    }
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const subcategories = cat.subcategories?.map(s => {
        if (s.id === subId) {
          return {
            ...s,
            name: editSubName.trim(),
            image: editSubImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400'
          };
        }
        return s;
      }) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Subcategory updated successfully');
      setEditingSubId(null);
    } catch (e: any) {
      toast.error('Failed to update subcategory: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const updateSubcategoryImage = async (catId: string, subId: string, newImage: string) => {
    if (!newImage) return;
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const newSubs = cat.subcategories?.map(s => s.id === subId ? { ...s, image: newImage } : s);
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories: newSubs });
      toast.success('Subcategory image updated');
    } catch (e: any) {
      toast.error(`Failed to update image: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  const deleteSubcategory = async (catId: string, subId: string) => {
    if (!window.confirm('Are you sure you want to delete this subcategory? All nested subcategories will be permanently deleted!')) return;
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const newSubs = cat.subcategories?.filter(s => s.id !== subId) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories: newSubs });
      toast.success('Subcategory deleted');
    } catch (e) {
      toast.error('Failed to delete subcategory');
    } finally {
      setBusy(false);
    }
  };

  const addNestedSubcategory = async (e: React.FormEvent, catId: string, subId: string) => {
    e.preventDefault();
    if (!newNestedName.trim()) return;
    const nestedId = newNestedName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const subcategories = cat.subcategories?.map(s => {
        if (s.id === subId) {
          const nestedSubs = s.subcategories ? [...s.subcategories, {
            id: nestedId,
            name: newNestedName.trim(),
            image: newNestedImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400'
          }] : [{
            id: nestedId,
            name: newNestedName.trim(),
            image: newNestedImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400'
          }];
          return { ...s, subcategories: nestedSubs };
        }
        return s;
      }) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Nested subcategory added successfully');
      setNewNestedName('');
      setNewNestedImage('');
      setActiveAddNestedId(null);
    } catch (e: any) {
      toast.error('Failed to add nested subcategory: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const startEditNestedSubcategory = (catId: string, subId: string, nested: SubCategory) => {
    setEditingNestedId({ catId, subId, nestedId: nested.id });
    setEditNestedName(nested.name);
    setEditNestedImage(nested.image || '');
  };

  const saveEditNestedSubcategory = async (catId: string, subId: string, nestedId: string) => {
    if (!editNestedName.trim()) {
      toast.error('Nested subcategory name is required');
      return;
    }
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const subcategories = cat.subcategories?.map(s => {
        if (s.id === subId) {
          const nestedSubs = s.subcategories?.map(n => {
            if (n.id === nestedId) {
              return {
                ...n,
                name: editNestedName.trim(),
                image: editNestedImage.trim() || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400'
              };
            }
            return n;
          }) || [];
          return { ...s, subcategories: nestedSubs };
        }
        return s;
      }) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Nested subcategory updated successfully');
      setEditingNestedId(null);
    } catch (e: any) {
      toast.error('Failed to update nested subcategory: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteNestedSubcategory = async (catId: string, subId: string, nestedId: string) => {
    if (!window.confirm('Are you sure you want to delete this nested subcategory?')) return;
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const subcategories = cat.subcategories?.map(s => {
        if (s.id === subId) {
          const nestedSubs = s.subcategories?.filter(n => n.id !== nestedId) || [];
          return { ...s, subcategories: nestedSubs };
        }
        return s;
      }) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Nested subcategory deleted');
    } catch (e: any) {
      toast.error('Failed to delete nested subcategory: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const moveSubcategory = async (catId: string, subIndex: number, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.subcategories) return;
      const subcategories = [...cat.subcategories];
      if (direction === 'up' && subIndex > 0) {
        [subcategories[subIndex - 1], subcategories[subIndex]] = [subcategories[subIndex], subcategories[subIndex - 1]];
      } else if (direction === 'down' && subIndex < subcategories.length - 1) {
        [subcategories[subIndex + 1], subcategories[subIndex]] = [subcategories[subIndex], subcategories[subIndex + 1]];
      } else {
        setBusy(false);
        return;
      }
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Subcategory reordered');
    } catch (e: any) {
      toast.error('Failed to reorder: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  const moveNestedSubcategory = async (catId: string, subId: string, nestedIndex: number, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return;
      const subcategories = cat.subcategories?.map(s => {
        if (s.id === subId && s.subcategories) {
          const nestedSubs = [...s.subcategories];
          if (direction === 'up' && nestedIndex > 0) {
            [nestedSubs[nestedIndex - 1], nestedSubs[nestedIndex]] = [nestedSubs[nestedIndex], nestedSubs[nestedIndex - 1]];
          } else if (direction === 'down' && nestedIndex < nestedSubs.length - 1) {
            [nestedSubs[nestedIndex + 1], nestedSubs[nestedIndex]] = [nestedSubs[nestedIndex], nestedSubs[nestedIndex + 1]];
          }
          return { ...s, subcategories: nestedSubs };
        }
        return s;
      }) || [];
      await setDoc(doc(db, 'categories', catId), { ...cat, subcategories });
      toast.success('Nested subcategory reordered');
    } catch (e: any) {
      toast.error('Failed to reorder: ' + e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Categories</h2>
          <p className="text-sm text-gray-500">Add, edit or remove categories, subcategories and nested subcategories (3 Levels)</p>
        </div>
        <button
          onClick={() => setShowAddCat(!showAddCat)}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-hover shadow-lg shadow-blue-500/10 flex items-center gap-2 self-start sm:self-center transition-all active:scale-95"
        >
          {showAddCat ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddCat ? 'Cancel' : 'New Category'}
        </button>
      </div>

      {showAddCat && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={addCategory}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md space-y-4"
        >
          <h3 className="font-bold text-gray-950 uppercase tracking-widest text-[10px] mb-2">Create New Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category Name</label>
              <input
                required
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-primary transition-all text-sm font-medium"
                placeholder="e.g. Fashion"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
                <span>Image URL / File</span>
                <label className="text-[9px] font-black text-primary hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Upload PNG/JPG
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        if (dataUrl) setNewCatImage(dataUrl);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </label>
              <input
                type="text"
                value={newCatImage.startsWith('data:') ? 'Local Uploaded File' : newCatImage}
                onChange={(e) => setNewCatImage(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-primary transition-all text-sm font-medium"
                placeholder="https://... or upload local file"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Icon Name</label>
              <select
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-primary transition-all text-sm font-medium"
              >
                <option value="sparkles">Sparkles</option>
                <option value="smartphone">Smartphone</option>
                <option value="shirt">Shirt</option>
                <option value="laptop">Laptop</option>
                <option value="home">Home</option>
                <option value="tv">TV</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddCat(false)}
              className="px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover shadow-md"
            >
              Save Category
            </button>
          </div>
        </motion.form>
      )}

      {categories.map(cat => (
        <div key={cat.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          
          {editingCatId === cat.id ? (
            <div className="flex flex-col gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Editing Category: {cat.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category Name</label>
                  <input
                    type="text"
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary transition-all text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
                    <span>Image URL / File</span>
                    <label className="text-[9px] font-black text-primary hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Upload File
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            if (dataUrl) setEditCatImage(dataUrl);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </label>
                  <input
                    type="text"
                    value={editCatImage.startsWith('data:') ? 'Local Uploaded File' : editCatImage}
                    onChange={(e) => setEditCatImage(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary transition-all text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Icon Name</label>
                  <select
                    value={editCatIcon}
                    onChange={(e) => setEditCatIcon(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary transition-all text-xs font-semibold"
                  >
                    <option value="sparkles">Sparkles</option>
                    <option value="smartphone">Smartphone</option>
                    <option value="shirt">Shirt</option>
                    <option value="laptop">Laptop</option>
                    <option value="home">Home</option>
                    <option value="tv">TV</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCatId(null)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveEditCategory(cat.id)}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-md flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => toggleCat(cat.id)} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-gray-900">
                  <ChevronRight className={`w-5 h-5 transition-transform ${expandedCats.includes(cat.id) ? 'rotate-90' : ''}`} />
                </button>
                <img src={cat.image} alt={cat.name} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shadow-sm" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    {cat.name}
                    <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Icon: {cat.icon || 'sparkles'}</span>
                  </h3>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-100">ID: {cat.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  disabled={busy}
                  onClick={() => startEditCategory(cat)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors text-gray-750"
                >
                  <Edit3 className="w-3.5 h-3.5 text-gray-550" />
                  Edit Details
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (activeAddSubCatId === cat.id) {
                      setActiveAddSubCatId(null);
                    } else {
                      setActiveAddSubCatId(cat.id);
                    }
                  }}
                  className="px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Subcategory
                </button>
                <button
                  disabled={busy}
                  onClick={() => deleteCategory(cat.id)}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors border border-rose-100/50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeAddSubCatId === cat.id && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={(e) => addSubcategory(e, cat.id)}
              className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-4"
            >
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add Subcategory to {cat.name}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Subcategory Name</label>
                  <input
                    required
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary transition-all text-xs font-medium"
                    placeholder="e.g. Mobiles"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
                    <span>Image URL / File</span>
                    <label className="text-[8px] font-black text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                      <Upload className="w-2.5 h-2.5" />
                      Upload PNG/JPG
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            if (dataUrl) setNewSubImage(dataUrl);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </label>
                  <input
                    type="text"
                    value={newSubImage.startsWith('data:') ? 'Local Uploaded File' : newSubImage}
                    onChange={(e) => setNewSubImage(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-primary transition-all text-xs font-medium"
                    placeholder="https://... or upload local file"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAddSubCatId(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover shadow-sm"
                >
                  Save Subcategory
                </button>
              </div>
            </motion.form>
          )}

          <AnimatePresence>
            {expandedCats.includes(cat.id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {cat.subcategories && cat.subcategories.length > 0 ? (
                  <div className="ml-0 sm:ml-8 pl-0 sm:pl-8 border-l-0 sm:border-l-2 border-gray-100 space-y-3 pt-2 mt-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Subcategories</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {cat.subcategories.map((sub, subIndex) => (
                  <div key={sub.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100/50 group/sub space-y-3">
                    
                    {editingSubId?.catId === cat.id && editingSubId?.subId === sub.id ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Subcategory Name</label>
                            <input
                              type="text"
                              value={editSubName}
                              onChange={(e) => setEditSubName(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-xs font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
                              <span>Image URL / File</span>
                              <label className="text-[8px] font-black text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                                <Upload className="w-2.5 h-2.5" /> Upload File
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUrl = ev.target?.result as string;
                                      if (dataUrl) setEditSubImage(dataUrl);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                            </label>
                            <input
                              type="text"
                              value={editSubImage.startsWith('data:') ? 'Local Uploaded File' : editSubImage}
                              onChange={(e) => setEditSubImage(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-xs font-semibold"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingSubId(null)}
                            className="px-2.5 py-1 bg-white border border-gray-250 rounded text-[10px] font-bold text-gray-500"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditSubcategory(cat.id, sub.id)}
                            disabled={busy}
                            className="px-2.5 py-1 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600 flex items-center gap-0.5"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleSub(cat.id, sub.id)}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700 flex-shrink-0"
                          >
                            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expandedSubs.includes(`${cat.id}-${sub.id}`) ? 'rotate-90' : ''}`} />
                          </button>
                          <img src={sub.image} alt={sub.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                          <div>
                            <span className="font-bold text-gray-800 text-sm">{sub.name}</span>
                            <div className="flex items-center gap-2">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">ID: {sub.id}</p>
                              {sub.subcategories && sub.subcategories.length > 0 && (
                                <span className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{sub.subcategories.length} nested</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col gap-0.5 mr-1">
                            <button
                              disabled={busy || subIndex === 0}
                              onClick={() => moveSubcategory(cat.id, subIndex, 'up')}
                              className="p-0.5 bg-white border border-gray-200 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={busy || subIndex === (cat.subcategories?.length || 0) - 1}
                              onClick={() => moveSubcategory(cat.id, subIndex, 'down')}
                              className="p-0.5 bg-white border border-gray-200 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => startEditSubcategory(cat.id, sub)}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (activeAddNestedId?.catId === cat.id && activeAddNestedId?.subId === sub.id) {
                                setActiveAddNestedId(null);
                              } else {
                                setActiveAddNestedId({ catId: cat.id, subId: sub.id });
                              }
                            }}
                            className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-black flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Plus className="w-3 h-3" /> Nested
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => deleteSubcategory(cat.id, sub.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors border border-rose-100/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeAddNestedId?.catId === cat.id && activeAddNestedId?.subId === sub.id && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        onSubmit={(e) => addNestedSubcategory(e, cat.id, sub.id)}
                        className="bg-white p-3 rounded-lg border border-gray-100 space-y-3 mt-2"
                      >
                        <h5 className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Add Nested Subcategory to {sub.name}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Name</label>
                            <input
                              required
                              type="text"
                              value={newNestedName}
                              onChange={(e) => setNewNestedName(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-xs font-semibold"
                              placeholder="e.g. Android"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center justify-between">
                              <span>Image</span>
                              <label className="text-[8px] font-black text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                                <Upload className="w-2 h-2" /> Upload
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUrl = ev.target?.result as string;
                                      if (dataUrl) setNewNestedImage(dataUrl);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                            </label>
                            <input
                              type="text"
                              value={newNestedImage.startsWith('data:') ? 'Local Uploaded File' : newNestedImage}
                              onChange={(e) => setNewNestedImage(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary text-xs font-semibold"
                              placeholder="Image URL"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveAddNestedId(null)}
                            className="px-2.5 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="px-2.5 py-1 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-hover shadow-sm"
                          >
                            Save
                          </button>
                        </div>
                      </motion.form>
                    )}

                    {sub.subcategories && sub.subcategories.length > 0 && (
                      <AnimatePresence>
                        {expandedSubs.includes(`${cat.id}-${sub.id}`) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 border-l border-gray-200 space-y-2 mt-2">
                              <h5 className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Nested Subcategories</h5>
                              <div className="space-y-1.5">
                                {sub.subcategories.map((nested, nestedIndex) => (
                                  <div key={nested.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-100">
                              
                                    {editingNestedId?.catId === cat.id && editingNestedId?.subId === sub.id && editingNestedId?.nestedId === nested.id ? (
                                      <div className="flex-grow flex flex-col gap-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <div className="space-y-0.5">
                                            <label className="text-[7px] font-black uppercase text-gray-400">Nested Name</label>
                                            <input
                                              type="text"
                                              value={editNestedName}
                                              onChange={(e) => setEditNestedName(e.target.value)}
                                              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none text-xs font-semibold"
                                            />
                                          </div>
                                          <div className="space-y-0.5">
                                            <label className="text-[7px] font-black uppercase text-gray-400">Image URL</label>
                                            <input
                                              type="text"
                                              value={editNestedImage}
                                              onChange={(e) => setEditNestedImage(e.target.value)}
                                              className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none text-xs font-semibold"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex justify-end gap-1">
                                          <button
                                            onClick={() => setEditingNestedId(null)}
                                            className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[9px] font-bold"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => saveEditNestedSubcategory(cat.id, sub.id, nested.id)}
                                            disabled={busy}
                                            className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-bold"
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <img src={nested.image} alt={nested.name} className="w-8 h-8 rounded object-cover border border-gray-100" />
                                          <div>
                                            <span className="font-semibold text-gray-700 text-xs">{nested.name}</span>
                                            <span className="text-[7px] font-bold text-gray-400 block uppercase tracking-wider">ID: {nested.id}</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="flex flex-col gap-0.5 mr-0.5">
                                            <button
                                              disabled={busy || nestedIndex === 0}
                                              onClick={() => moveNestedSubcategory(cat.id, sub.id, nestedIndex, 'up')}
                                              className="p-0.5 bg-gray-50 border border-gray-150 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                              title="Move up"
                                            >
                                              <ArrowUp className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              disabled={busy || nestedIndex === (sub.subcategories?.length || 0) - 1}
                                              onClick={() => moveNestedSubcategory(cat.id, sub.id, nestedIndex, 'down')}
                                              className="p-0.5 bg-gray-50 border border-gray-150 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                              title="Move down"
                                            >
                                              <ArrowDown className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                          <button
                                            disabled={busy}
                                            onClick={() => startEditNestedSubcategory(cat.id, sub.id, nested)}
                                            className="p-1 bg-gray-50 border border-gray-150 rounded text-gray-500 hover:bg-gray-100"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button
                                            disabled={busy}
                                            onClick={() => deleteNestedSubcategory(cat.id, sub.id, nested.id)}
                                            className="p-1 bg-rose-50 text-rose-500 rounded hover:bg-rose-100"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </>
                                    )}

                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}

                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ml-0 sm:ml-8 pl-0 sm:pl-8 text-xs text-gray-400 italic font-medium mt-4">No subcategories created yet.</div>
          )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      ))}
    </div>
  );
}

function BannersManagementView() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banners');
    });
    return () => unsubscribe();
  }, []);

  const toggleBannerStatus = async (banner: Banner) => {
    try {
      await updateDoc(doc(db, 'banners', banner.id), { active: !banner.active });
      toast.success(`Banner ${!banner.active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error('Failed to update banner status');
    }
  };

  const deleteBanner = async (banner: Banner) => {
    try {
      await deleteDoc(doc(db, 'banners', banner.id));
      toast.success('Banner deleted');
    } catch (err) {
      toast.error('Failed to delete banner');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Banner Management</h2>
          <p className="text-sm text-gray-500">Manage home page promotional sliders</p>
        </div>
        <button
          onClick={() => {
            setEditingBanner(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-400">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-400">No banners found.</div>
        ) : banners.map(banner => (
          <div key={banner.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm group">
            <div className="relative h-48 overflow-hidden">
              <img src={banner.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-2xl m-4 w-[calc(100%-2rem)]" alt="" />
              <div className="absolute inset-4 bg-gradient-to-t from-black/60 to-transparent rounded-2xl" />
              <div className="absolute bottom-8 left-8 right-8">
                <h4 className="text-white font-bold truncate">{banner.title}</h4>
                <p className="text-white/80 text-xs truncate">{banner.subtitle}</p>
              </div>
              <div className="absolute top-8 right-8 flex gap-2">
                <button
                  onClick={() => {
                    setEditingBanner(banner);
                    setShowModal(true);
                  }}
                  className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteBanner(banner)}
                  className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-red-500 transition-all border border-white/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 pt-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 px-2.5 py-1 rounded-lg">Order: {banner.order}</span>
              </div>
              <button
                onClick={() => toggleBannerStatus(banner)}
                className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-xl transition-all ${banner.active ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
              >
                {banner.active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <AddBannerModal
            banner={editingBanner}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddBannerModal({ banner, onClose }: { banner: Banner | null, onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<Banner>>(() => {
    const defaults = {
      title: '',
      subtitle: '',
      image: '',
      link: '/',
      active: true,
      order: 0
    };
    if (banner) {
      return {
        ...defaults,
        ...banner,
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image: banner.image || '',
        link: banner.link || '/',
      };
    }
    return defaults;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tid = toast.loading('Saving banner...');
    try {
      const id = banner?.id || `banner_${Date.now()}`;
      await setDoc(doc(db, 'banners', id), {
        ...formData,
        id,
        order: Number(formData.order)
      }, { merge: true });
      toast.success('Banner saved', { id: tid });
      onClose();
    } catch (err) {
      toast.error('Failed to save banner', { id: tid });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{banner ? 'Edit Banner' : 'Add Banner'}</h3>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">Slider Component</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Main Title</label>
            <input
              required
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Summer Collection 2024"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Contextual Subtitle</label>
            <input
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all"
              value={formData.subtitle}
              onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))}
              placeholder="e.g. Up to 50% Off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Banner Image URL</label>
            <input
              required
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all"
              value={formData.image}
              onChange={e => setFormData(p => ({ ...p, image: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Display Order</label>
              <input
                type="number"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold"
                value={formData.order}
                onChange={e => setFormData(p => ({ ...p, order: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Redirect Path</label>
              <input
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all"
                value={formData.link}
                onChange={e => setFormData(p => ({ ...p, link: e.target.value }))}
              />
            </div>
          </div>
          <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl shadow-gray-200 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all">
            {banner ? 'Update Banner' : 'Create Banner'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CouponsManagementView() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('expiry', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Coupon);
      setCoupons(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'coupons');
    });
    return () => unsubscribe();
  }, []);

  const deleteCoupon = async (code: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', code));
      toast.success('Coupon deleted');
    } catch (err) {
      toast.error('Failed to delete coupon');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Promo Engine</h2>
          <p className="text-sm text-gray-500">Generate discount codes and incentives</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-400">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-400">No active coupons. Create one to start!</div>
        ) : coupons.map(coupon => (
          <div key={coupon.code} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 -mr-10 -mt-10 rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="flex justify-between items-start mb-4">
              <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <button
                onClick={() => deleteCoupon(coupon.code)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">{coupon.code}</h3>
            <p className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-widest">
              {coupon.type === 'percent' ? `${coupon.value}% OFF` : `₹${coupon.value} FLAT OFF`}
            </p>
            <div className="space-y-2 pt-4 border-t border-dashed border-gray-100">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                <span>Threshold</span>
                <span className="text-gray-900 font-black">₹{coupon.minAmount}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                <span>Valid Until</span>
                <span className={new Date(coupon.expiry) < new Date() ? 'text-red-500' : 'text-gray-900 font-black'}>
                  {new Date(coupon.expiry).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && <AddCouponModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function AddCouponModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<Coupon>({
    code: '',
    type: 'percent',
    value: 10,
    minAmount: 0,
    expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return;
    const tid = toast.loading('Creating coupon...');
    try {
      await setDoc(doc(db, 'coupons', formData.code.toUpperCase()), {
        ...formData,
        code: formData.code.toUpperCase()
      });
      toast.success('Coupon activated!', { id: tid });
      onClose();
    } catch (err) {
      toast.error('Failed to create coupon', { id: tid });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Generate Coupon</h3>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">Incentive Engine</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Promo Code</label>
            <input
              required
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-4 outline-none focus:bg-white focus:border-primary/20 transition-all font-black tracking-[0.3em] uppercase text-center text-xl text-primary"
              placeholder="e.g. FLASH50"
              value={formData.code}
              onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Reward Type</label>
              <select
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold text-sm"
                value={formData.type}
                onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))}
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Fixed Amount (₹)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Reward Value</label>
              <input
                type="number"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-black text-sm"
                value={formData.value}
                onChange={e => setFormData(p => ({ ...p, value: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Min Spend (₹)</label>
              <input
                type="number"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-black text-sm"
                value={formData.minAmount}
                onChange={e => setFormData(p => ({ ...p, minAmount: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Validity Ends</label>
              <input
                type="date"
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-3 outline-none focus:bg-white focus:border-primary/20 transition-all font-bold text-sm"
                value={formData.expiry}
                onChange={e => setFormData(p => ({ ...p, expiry: e.target.value }))}
              />
            </div>
          </div>
          <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl shadow-gray-200 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all">
            Save & Activate
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ReviewsManagementView() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    if (filter !== 'all') {
      q = query(collection(db, 'reviews'), where('status', '==', filter));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(data);
      setLoading(false);

      // Fetch missing product names
      const missingIds = data
        .map(r => r.productId)
        .filter(id => !productNames[id]);

      if (missingIds.length > 0) {
        const uniqueIds = Array.from(new Set(missingIds));
        const newNames: Record<string, string> = { ...productNames };

        // Fetch in chunks of 10 (Firestore 'in' limit)
        for (let i = 0; i < uniqueIds.length; i += 10) {
          const chunk = uniqueIds.slice(i, i + 10);
          const qProd = query(collection(db, 'products'), where('__name__', 'in', chunk));
          const prodSnap = await getDocs(qProd);
          prodSnap.forEach(doc => {
            newNames[doc.id] = doc.data().name;
          });
        }
        setProductNames(newNames);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });
    return () => unsubscribe();
  }, [filter, productNames]);

  const updateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateDoc(doc(db, 'reviews', reviewId), { status });
      toast.success(`Review ${status}`);
    } catch (err) {
      toast.error('Failed to update review status');
    }
  };

  const deleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      toast.success('Review deleted');
    } catch (err) {
      toast.error('Failed to delete review');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all duration-500">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review Moderation</h2>
          <p className="text-sm text-gray-500">Approve or reject customer product reviews</p>
        </div>
        <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${filter === s ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-400">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <Activity className="w-16 h-16 text-gray-200 mb-4" />
            <p className="text-lg font-bold text-gray-400">No reviews found.</p>
          </div>
        ) : reviews.map(review => (
          <div key={review.id} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all duration-500 group flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <img src={review.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName)}`} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-50" alt="" />
                <div>
                  <h4 className="font-black text-gray-900 leading-tight">{review.userName}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < review.rating ? 'bg-primary' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            <div className="bg-gray-50/50 rounded-2xl p-4 mb-6 border border-gray-100/50 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-black uppercase text-primary tracking-widest truncate">
                  {productNames[review.productId] || 'Loading product...'}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed font-medium italic">
                "{review.comment}"
              </p>
            </div>

            {review.images && review.images.length > 0 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {review.images.map((img, idx) => (
                  <img key={idx} src={img} className="w-16 h-16 rounded-xl object-cover border border-gray-100 flex-shrink-0" alt="" />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
              <div className="flex gap-2">
                <button
                  onClick={() => updateReviewStatus(review.id, 'approved')}
                  disabled={review.status === 'approved'}
                  title="Approve Review"
                  className={`p-2.5 rounded-xl transition-all ${review.status === 'approved' ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateReviewStatus(review.id, 'rejected')}
                  disabled={review.status === 'rejected'}
                  title="Reject Review"
                  className={`p-2.5 rounded-xl transition-all ${review.status === 'rejected' ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteReview(review.id)}
                  title="Delete Permanently"
                  className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-900 hover:text-white transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${review.status === 'approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  review.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                {review.status || 'pending'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function VendorsManagementView() {
  const [vendors, setVendors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'vendor'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UserProfile);
      setVendors(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Partners & Vendors</h2>
          <p className="text-sm text-gray-500 font-medium">Monitoring multi-vendor operations and store performance</p>
        </div>
        <div className="flex -space-x-3">
          {vendors.slice(0, 5).map((v, i) => (
            <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-sm">
              <img src={v.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.displayName)}`} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
          {vendors.length > 5 && (
            <div className="w-10 h-10 rounded-full border-4 border-white bg-primary text-white flex items-center justify-center text-[10px] font-black z-10 shadow-lg">
              +{vendors.length - 5}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-400 italic">Processing vendor data...</div>
        ) : vendors.length === 0 ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <Users className="w-16 h-16 text-gray-200 mb-4" />
            <p className="text-lg font-bold text-gray-400">No vendors registered yet.</p>
            <button className="mt-4 text-primary font-black uppercase text-xs tracking-widest hover:underline">Invite Partners</button>
          </div>
        ) : vendors.map(vendor => (
          <div key={vendor.uid} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-blue-50 transition-all duration-500 group relative">
            <div className="absolute top-8 right-8">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-200 animate-pulse" />
            </div>

            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-50 to-blue-100 p-1 mb-4 group-hover:scale-105 transition-transform duration-500">
                <img
                  src={vendor.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.displayName)}`}
                  className="w-full h-full rounded-[28px] object-cover"
                  alt=""
                />
              </div>
              <h4 className="text-xl font-black text-gray-900 tracking-tight">{vendor.displayName}</h4>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{vendor.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-gray-50">
              <div className="text-center p-4 bg-gray-50 rounded-3xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Products</p>
                <p className="text-lg font-black text-gray-900">24</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-3xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-[10px] font-black text-blue-600 uppercase">Verified</p>
              </div>
            </div>

            <button className="w-full mt-6 py-4 bg-gray-50 text-gray-400 rounded-3xl font-black uppercase text-[10px] tracking-widest group-hover:bg-gray-900 group-hover:text-white transition-all duration-300">
              View Store Profile
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AnnouncementsManagementView() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });
    return () => unsubscribe();
  }, []);

  const toggleAnnouncement = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'announcements', id), { active: !active });
      toast.success(`Announcement ${!active ? 'published' : 'hidden'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast.success('Announcement deleted');
    } catch (err) {
      toast.error('Failed to delete announcement');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm transition-all duration-700">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Global Announcements</h2>
          <p className="text-sm text-gray-500 font-medium">Broadcast messages to all store users in real-time</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-3 bg-gray-900 text-white px-8 py-3.5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-gray-200 hover:scale-105 active:scale-95 transition-all"
        >
          <Bell className="w-5 h-5" />
          Create Alert
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center text-gray-400 italic">Synchronizing broadcast data...</div>
        ) : announcements.length === 0 ? (
          <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Bell className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-xl font-black text-gray-300">No active broadcasts.</p>
          </div>
        ) : announcements.map(ann => (
          <div key={ann.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all duration-500 overflow-hidden relative group">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-1000 ${ann.type === 'sale' ? 'bg-blue-500' :
                ann.type === 'critical' ? 'bg-red-500' : 'bg-blue-500'
              }`} />

            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${ann.type === 'sale' ? 'bg-blue-50 text-blue-600' :
                      ann.type === 'critical' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                    {ann.type}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold">{new Date(ann.createdAt).toLocaleString()}</span>
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2 truncate max-w-2xl">{ann.title}</h3>
                <p className="text-gray-500 font-medium leading-relaxed max-w-3xl">{ann.content}</p>
              </div>

              <div className="flex items-center gap-3 ml-8">
                <button
                  onClick={() => toggleAnnouncement(ann.id, ann.active)}
                  className={`w-14 h-8 rounded-full transition-all flex items-center px-1.5 ${ann.active ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-all ${ann.active ? 'translate-x-6' : ''}`} />
                </button>
                <button
                  onClick={() => deleteAnnouncement(ann.id)}
                  className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all duration-300"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="bg-white rounded-[48px] p-12 w-full max-w-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">New Global Broadcast</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">This message will be visible to all users instantly.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const target = e.target as any;
                const tid = toast.loading('Initiating broadcast...');
                try {
                  const id = `ann_${Date.now()}`;
                  await setDoc(doc(db, 'announcements', id), {
                    id,
                    title: target.title.value,
                    content: target.content.value,
                    type: target.type.value,
                    active: true,
                    createdAt: new Date().toISOString()
                  });
                  toast.success('Broadcast live!', { id: tid });
                  setShowModal(false);
                } catch (err) {
                  toast.error('Transmission failed', { id: tid });
                }
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Alert Type</label>
                  <select name="type" className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm">
                    <option value="sale">Promotion / Sale</option>
                    <option value="info">General Info</option>
                    <option value="critical">System Alert</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Headline</label>
                  <input name="title" required className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black" placeholder="Main header..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Message Body</label>
                  <textarea name="content" required className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium h-32" placeholder="Full details..." />
                </div>
                <button type="submit" className="w-full py-6 bg-primary text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all mt-6">
                  Execute Broadcast
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReturnManagementView() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReturnRequest['status'] | 'all'>('all');

  useEffect(() => {
    let q = query(collection(db, 'returns'), orderBy('createdAt', 'desc'));
    if (filter !== 'all') {
      q = query(collection(db, 'returns'), where('status', '==', filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnRequest));
      setReturns(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'returns');
    });

    return () => unsubscribe();
  }, [filter]);

  const updateReturnStatus = async (returnId: string, status: ReturnRequest['status']) => {
    try {
      await updateDoc(doc(db, 'returns', returnId), {
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Return request ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const statusColors: any = {
    requested: 'bg-amber-100 text-amber-600',
    approved: 'bg-blue-100 text-blue-600',
    rejected: 'bg-red-100 text-red-600',
    pickup_scheduled: 'bg-indigo-100 text-indigo-600',
    returned: 'bg-purple-100 text-purple-600',
    refunded: 'bg-green-100 text-green-600',
  };

  const returnMetrics = [
    { name: 'Requested', value: returns.filter(r => r.status === 'requested').length || 5 },
    { name: 'Approved', value: returns.filter(r => r.status === 'approved').length || 12 },
    { name: 'Refunded', value: returns.filter(r => r.status === 'refunded').length || 8 },
    { name: 'Returned', value: returns.filter(r => r.status === 'returned').length || 10 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Returns Overview</h3>
              <p className="text-sm text-gray-500 font-medium">Monitoring return lifecycle and refund patterns</p>
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1 overflow-x-auto max-w-[450px] scrollbar-none">
              {(['all', 'requested', 'approved', 'pickup_scheduled', 'returned', 'refunded'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full mb-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={returnMetrics}>
                <defs>
                  <linearGradient id="returnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }} />
                <Area type="monotone" dataKey="value" stroke="#84cc16" strokeWidth={4} fill="url(#returnGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50">
                <tr>
                  <th className="px-4 py-6">Reference</th>
                  <th className="px-4 py-6">Reason</th>
                  <th className="px-4 py-6">Amount</th>
                  <th className="px-4 py-6 text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold italic">Scanning return signatures...</td></tr>
                ) : returns.length === 0 ? (
                  <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold">No return requests found in repository.</td></tr>
                ) : returns.map(ret => (
                  <tr key={ret.id} className="group hover:bg-gray-50/50 transition-all">
                    <td className="px-4 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900 tracking-tight">#{ret.id.slice(-8).toUpperCase()}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest mt-1.5 w-fit px-2.5 py-1 rounded-lg ${statusColors[ret.status]}`}>{ret.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <p className="text-xs text-gray-500 font-medium line-clamp-2 max-w-xs leading-relaxed">{ret.reason}</p>
                    </td>
                    <td className="px-4 py-6">
                      <span className="text-sm font-black text-gray-900 italic">₹{ret.refundAmount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {ret.status === 'requested' && (
                          <>
                            <button onClick={() => updateReturnStatus(ret.id, 'approved')} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Check className="w-5 h-5" /> </button>
                            <button onClick={() => updateReturnStatus(ret.id, 'rejected')} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><X className="w-5 h-5" /></button>
                          </>
                        )}
                        {ret.status === 'approved' && (
                          <button onClick={() => updateReturnStatus(ret.id, 'pickup_scheduled')} className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200">Schedule Pickup</button>
                        )}
                        {ret.status === 'pickup_scheduled' && (
                          <button onClick={() => updateReturnStatus(ret.id, 'returned')} className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200">Confirm Return</button>
                        )}
                        {ret.status === 'returned' && (
                          <button onClick={() => updateReturnStatus(ret.id, 'refunded')} className="px-6 py-3 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-green-700 shadow-xl shadow-green-100">Issue Refund</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl shadow-gray-200">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
            <div className="relative z-10">
              <PieChart className="w-10 h-10 text-white/40 mb-6" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Total Refund Capital</p>
              <p className="text-4xl font-black tracking-tighter italic">₹{(returns.reduce((acc, r) => acc + r.refundAmount, 0)).toLocaleString()}</p>
              <div className="mt-10 pt-8 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase opacity-40">Success Rate</span>
                  <span className="text-xs font-black">94.2%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '94.2%' }} className="h-full bg-blue-500" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Evidence Logs</h3>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-gray-50 rounded-[28px] overflow-hidden border-4 border-white shadow-sm group cursor-pointer">
                  <img src={`https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80&rand=${i}`} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


