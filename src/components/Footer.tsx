import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useAuthStore } from '../store';
import Logo from './Logo';

export default function Footer() {
  const { user } = useAuthStore();

  return (
    <footer className="hidden md:block bg-gray-900 text-gray-400 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <Logo variant="dark" />
            </Link>
            <p className="text-sm leading-relaxed font-medium">
              India's premier digital destination for fashion, electronics, and lifestyle. Experience the future of online shopping with ViBa Mart.
            </p>
            {user?.role === 'admin' && (
              <Link to="/admin" className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-all">
                Admin Dashboard
              </Link>
            )}
            <div className="flex gap-4">
              <SocialLink icon={Facebook} label="Facebook" />
              <SocialLink icon={Twitter} label="Twitter" />
              <SocialLink icon={Instagram} label="Instagram" />
              <SocialLink icon={Youtube} label="Youtube" />
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h3 className="text-white font-black uppercase tracking-widest text-xs">Shop</h3>
            <ul className="space-y-4 text-sm font-bold uppercase tracking-widest text-[11px]">
              <li><Link to="/products" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link to="/products?category=1" className="hover:text-white transition-colors">Mobiles</Link></li>
              <li><Link to="/products?category=2" className="hover:text-white transition-colors">Fashion</Link></li>
              <li><Link to="/products?category=3" className="hover:text-white transition-colors">Electronics</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-6">
            <h3 className="text-white font-black uppercase tracking-widest text-xs">Help & Support</h3>
            <ul className="space-y-4 text-sm font-bold uppercase tracking-widest text-[11px]">
              <li><Link to="/track-order" className="text-primary hover:text-white transition-colors">Track Order</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="text-white font-black uppercase tracking-widest text-xs">Get in Touch</h3>
            <div className="space-y-4">
               <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-xs font-bold leading-relaxed">123 ViBa Tower, Jakkur, Bangalore, Karnataka, 560064</p>
               </div>
               <div className="flex items-center gap-4">
                  <Mail className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-xs font-bold">support@vibamart.com</p>
               </div>
               <div className="flex items-center gap-4">
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-xs font-bold">+91 1800 123 4567</p>
               </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
           <p className="text-[10px] font-black uppercase tracking-[0.2em]">© 2024 ViBa Mart Pvt Ltd. All Rights Reserved.</p>
           <div className="flex gap-4">
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-4 opacity-50 grayscale hover:grayscale-0 transition-all" alt="Paypal" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg" className="h-4 opacity-50 grayscale hover:grayscale-0 transition-all" alt="Mastercard" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png" className="h-4 opacity-50 grayscale hover:grayscale-0 transition-all" alt="Visa" />
           </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon: Icon, label = "Social Link" }: any) {
  return (
    <a href="#" aria-label={label} className="w-11 h-11 touch-target bg-gray-800 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all">
       <Icon className="w-5 h-5" />
    </a>
  );
}
