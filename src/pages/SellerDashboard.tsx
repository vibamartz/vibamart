import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, Navigate } from 'react-router-dom';
import {
  BarChart3, Box, ShoppingBag, Bell, Settings, LogOut,
  Search, Menu, X, TrendingUp, CreditCard, Filter, Download,
  Zap, Star, ArrowUpRight, ArrowDownRight, Activity, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuthStore } from '../store';
import Logo from '../components/Logo';
import ProductManagementView from '../components/ProductManagementView';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Mock Data
const SALES_DATA = [
  { name: 'Mon', revenue: 4000, orders: 24 },
  { name: 'Tue', revenue: 3000, orders: 13 },
  { name: 'Wed', revenue: 5500, orders: 38 },
  { name: 'Thu', revenue: 4500, orders: 29 },
  { name: 'Fri', revenue: 6000, orders: 48 },
  { name: 'Sat', revenue: 8000, orders: 62 },
  { name: 'Sun', revenue: 7500, orders: 55 },
];

const RECENT_ORDERS = [
  { id: '#ORD-7892', customer: 'Arjun Kumar', date: 'Just now', amount: '₹12,400', status: 'processing', items: 3 },
  { id: '#ORD-7891', customer: 'Meera Reddy', date: '2 hours ago', amount: '₹4,500', status: 'shipped', items: 1 },
  { id: '#ORD-7890', customer: 'Rohan Gupta', date: '5 hours ago', amount: '₹8,999', status: 'delivered', items: 2 },
  { id: '#ORD-7889', customer: 'Sneha Patel', date: 'Yesterday', amount: '₹2,100', status: 'cancelled', items: 1 },
  { id: '#ORD-7888', customer: 'Vikram Singh', date: 'Yesterday', amount: '₹15,000', status: 'delivered', items: 4 },
];

const NOTIFICATIONS = [
  { id: 1, type: 'update', title: 'New Feature: AI Descriptions', message: 'You can now auto-generate product descriptions using AI.', time: '2h ago' },
  { id: 2, type: 'alert', title: 'Low Stock Alert', message: 'Wireless Earbuds Pro is running low on stock (2 left).', time: '5h ago' },
  { id: 3, type: 'success', title: 'Milestone Reached!', message: 'You have crossed ₹1,00,000 in sales this month.', time: '1d ago' },
];

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [dateFilter, setDateFilter] = useState('This Week');

  // Typically, a seller dashboard requires a 'vendor' or 'admin' role. 
  // If the user isn't logged in, they are redirected.
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showMobileSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out transform ${showMobileSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100/50">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo />
            <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Seller Hub
            </span>
          </Link>
          <button onClick={() => setShowMobileSidebar(false)} className="lg:hidden p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
              {user.displayName?.[0] || 'V'}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{user.displayName || 'Vendor'}</p>
              <p className="text-xs text-indigo-600 font-medium">Pro Seller</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <SidebarItem icon={BarChart3} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setShowMobileSidebar(false); }} />
          <SidebarItem icon={Box} label="My Products" active={activeTab === 'products'} onClick={() => { setActiveTab('products'); setShowMobileSidebar(false); }} badge="12" />
          <SidebarItem icon={ShoppingBag} label="Orders" active={activeTab === 'orders'} onClick={() => { setActiveTab('orders'); setShowMobileSidebar(false); }} badge="5 New" />
          <SidebarItem icon={Activity} label="Analytics" active={activeTab === 'analytics'} onClick={() => { setActiveTab('analytics'); setShowMobileSidebar(false); }} />
          <SidebarItem icon={Settings} label="Store Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setShowMobileSidebar(false); }} />
        </nav>

        <div className="p-4 border-t border-gray-100/50">
          <button onClick={() => signOut(auth)} className="flex items-center gap-3 text-gray-500 hover:text-rose-600 hover:bg-rose-50 px-4 py-3 rounded-xl w-full transition-all font-medium group">
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white/60 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMobileSidebar(true)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight hidden sm:block">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="relative hidden md:block group">
              <input 
                type="text" 
                placeholder="Search orders, products..." 
                className="w-72 bg-white border border-gray-200 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm group-hover:border-gray-300" 
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            
            <button className="relative p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {activeTab === 'dashboard' && (
              <>
                {/* Top Bar with Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Store Overview</h2>
                <p className="text-sm text-gray-500 mt-1">Here's what's happening with your store today.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm cursor-pointer"
                  >
                    <option>Today</option>
                    <option>This Week</option>
                    <option>This Month</option>
                    <option>This Year</option>
                  </select>
                  <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 font-semibold text-sm px-4">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Revenue" 
                value="₹45,500" 
                trend="+12.5%" 
                isUp={true} 
                icon={TrendingUp} 
                color="from-blue-500 to-indigo-600" 
              />
              <StatCard 
                title="Total Orders" 
                value="245" 
                trend="+8.2%" 
                isUp={true} 
                icon={ShoppingBag} 
                color="from-emerald-400 to-emerald-600" 
              />
              <StatCard 
                title="Store Views" 
                value="12.4k" 
                trend="-2.4%" 
                isUp={false} 
                icon={Star} 
                color="from-purple-500 to-pink-600" 
              />
              <StatCard 
                title="Avg. Order Value" 
                value="₹1,850" 
                trend="+5.1%" 
                isUp={true} 
                icon={CreditCard} 
                color="from-amber-400 to-orange-500" 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Chart */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Revenue Analytics</h3>
                    <p className="text-sm text-gray-500">Sales performance over time</p>
                  </div>
                  <div className="flex gap-2">
                    {['Revenue', 'Orders'].map(metric => (
                      <button 
                        key={metric}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${metric === 'Revenue' ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {metric}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SALES_DATA}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dx={-10} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                        cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Column - Notifications & Updates */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-indigo-500/30 blur-xl"></div>
                  
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-4 border border-white/10">
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      Pro Tip
                    </div>
                    <h3 className="text-xl font-bold mb-2">Boost Your Sales</h3>
                    <p className="text-indigo-100 text-sm mb-5 leading-relaxed">
                      Optimize your product listings with our new AI generation tool to increase conversion rates by up to 25%.
                    </p>
                    <button className="bg-white text-indigo-900 w-full py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg">
                      Try AI Generator
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-900">Notifications</h3>
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Mark all read</button>
                  </div>
                  <div className="space-y-5">
                    {NOTIFICATIONS.map(note => (
                      <div key={note.id} className="flex gap-4 group">
                        <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${
                          note.type === 'update' ? 'bg-blue-500' : 
                          note.type === 'alert' ? 'bg-amber-500' : 'bg-emerald-500'
                        } shadow-[0_0_8px_rgba(0,0,0,0.2)]`} style={{ boxShadow: `0 0 10px var(--color-${note.type === 'update' ? 'blue' : note.type === 'alert' ? 'amber' : 'emerald'}-500)`}}></div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{note.title}</p>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{note.message}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">{note.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Orders</h3>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                    <Filter className="w-4 h-4" />
                    Filter
                  </button>
                  <Link to="/seller/orders" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                    View All
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Items</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] uppercase font-bold text-gray-500 tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {RECENT_ORDERS.map((order, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={order.id} 
                        className="hover:bg-indigo-50/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">{order.id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                              {order.customer.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-gray-700">{order.customer}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{order.date}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{order.items}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.amount}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity">
                            Manage
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}

            {activeTab === 'products' && <ProductManagementView />}

            {/* Bottom Padding */}
            <div className="h-8"></div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' 
          : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400'}`} />
        <span>{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, trend, isUp, icon: Icon, color }: any) {
  return (
    <motion.div 
      whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
      className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm transition-all duration-300 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-5 rounded-bl-full group-hover:scale-110 transition-transform duration-500`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg shadow-gray-200/50`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {trend}
        </div>
      </div>
      <div className="relative z-10">
        <h4 className="text-gray-500 text-sm font-medium mb-1">{title}</h4>
        <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    delivered: 'bg-emerald-50 text-emerald-600 ring-emerald-500/20',
    shipped: 'bg-blue-50 text-blue-600 ring-blue-500/20',
    processing: 'bg-indigo-50 text-indigo-600 ring-indigo-500/20',
    cancelled: 'bg-rose-50 text-rose-600 ring-rose-500/20',
  };

  const style = styles[status] || 'bg-gray-50 text-gray-600 ring-gray-500/20';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${style}`}>
      {status}
    </span>
  );
}
