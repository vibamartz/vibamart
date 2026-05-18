import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, HelpCircle, ShoppingBag, Truck, CreditCard, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FAQ_DATA = [
  {
    category: "Ordering",
    icon: ShoppingBag,
    questions: [
      {
        q: "How do I place an order?",
        a: "To place an order, browse our collection, select your desired items and variants, and click 'Add to Cart'. Once you're ready, click on the cart icon and proceed to checkout. Follow the prompts to enter your delivery address and select a payment method."
      },
      {
        q: "Can I modify my order after placing it?",
        a: "Orders can only be modified within 1 hour of placement and if they haven't been processed for shipping. Please contact our support team immediately or check your profile for 'Edit Order' options."
      },
      {
        q: "Do I need an account to shop?",
        a: "While you can browse products as a guest, you'll need to sign in with your Google account to place an order and track your shipment."
      }
    ]
  },
  {
    category: "Shipping & Delivery",
    icon: Truck,
    questions: [
      {
        q: "How long does delivery take?",
        a: "Standard delivery usually takes 2-5 business days depending on your location. Premium delivery is available in select cities for next-day arrival."
      },
      {
        q: "How can I track my order?",
        a: "Once your order is shipped, you'll receive a notification. You can track your order in real-time from the 'My Orders' section in your profile or via the direct tracking link provided in your order success page."
      },
      {
        q: "Do you offer international shipping?",
        a: "Currently, we only ship across India. We are working on expanding our reach to international locations soon."
      }
    ]
  },
  {
    category: "Payments",
    icon: CreditCard,
    questions: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit/debit cards, UPI (Google Pay, PhonePe), Net Banking, and Cash on Delivery (COD) for eligible pin codes."
      },
      {
        q: "Is it safe to use my card details on ViBa Mart?",
        a: "Absolutely. We use industry-standard encryption and secure payment gateways to ensure your financial information is 100% protected. We do not store your complete card details on our servers."
      }
    ]
  },
  {
    category: "Returns & Refunds",
    icon: RefreshCw,
    questions: [
      {
        q: "What is your return policy?",
        a: "We offer a 7-day easy return policy for most items. Items must be unused, in their original packaging, and with all tags intact. Some products like electronics and personal care may have different policies."
      },
      {
        q: "When will I get my refund?",
        a: "Refunds are typically processed within 5-7 business days after we receive and inspect the returned item. The amount will be credited back to your original payment method."
      }
    ]
  }
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  const filteredFaqs = FAQ_DATA.map(category => ({
    ...category,
    questions: category.questions.filter(faq => 
      faq.q.toLowerCase().includes(searchTerm.toLowerCase()) || 
      faq.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4"
           >
             <HelpCircle className="w-4 h-4" /> Help Center
           </motion.div>
           <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">How can we help?</h1>
           
           <div className="relative max-w-xl mx-auto mt-8">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search for answers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 pl-14 pr-6 font-bold text-gray-900 focus:border-primary outline-none shadow-xl shadow-blue-100/20 transition-all"
              />
           </div>
        </div>

        <div className="space-y-12">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((category, catIdx) => (
              <motion.div 
                key={catIdx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 mb-6">
                   <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-blue-100">
                      <category.icon className="w-6 h-6" />
                   </div>
                   <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">{category.category}</h2>
                </div>

                <div className="space-y-3">
                  {category.questions.map((faq, faqIdx) => {
                    const isOpen = activeQuestion === `${catIdx}-${faqIdx}`;
                    return (
                      <div 
                        key={faqIdx}
                        className={`bg-white rounded-2xl border-2 transition-all duration-300 ${isOpen ? 'border-primary shadow-xl shadow-blue-100' : 'border-transparent hover:border-gray-200'}`}
                      >
                         <button 
                           onClick={() => setActiveQuestion(isOpen ? null : `${catIdx}-${faqIdx}`)}
                           className="w-full px-6 py-5 flex items-center justify-between text-left"
                         >
                            <span className="font-bold text-gray-900 pr-8">{faq.q}</span>
                            {isOpen ? <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                         </button>
                         <AnimatePresence>
                           {isOpen && (
                             <motion.div 
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: 'auto', opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden"
                             >
                               <div className="px-6 pb-6 text-gray-500 font-medium leading-relaxed">
                                  {faq.a}
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center">
               <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-gray-300" />
               </div>
               <h3 className="text-xl font-black text-gray-900 mb-2">No results found</h3>
               <p className="text-gray-500 font-medium max-w-sm mx-auto">We couldn't find any answers matching "{searchTerm}". Try different keywords or contact our support.</p>
            </div>
          )}
        </div>

        <div className="mt-20 bg-gray-900 rounded-[3rem] p-10 md:p-16 text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full -ml-32 -mb-32 blur-3xl" />
           
           <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-6">Still have questions?</h2>
              <p className="text-gray-400 font-medium mb-10 max-w-md mx-auto">Our support team is available 24/7 to help you with any issues or queries.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                 <a href="mailto:support@vibamart.com" className="w-full sm:w-auto bg-primary text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover shadow-xl shadow-blue-900/40 transition-all active:scale-95">Contact Support</a>
                 <button className="w-full sm:w-auto bg-white/10 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-all active:scale-95">Live Chat</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
