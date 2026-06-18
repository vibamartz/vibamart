const fs = require('fs');

async function runRefactor() {
  let content = fs.readFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/Profile.tsx', 'utf-8');

  const target = `      {/* Request Return Modal */}`;

  const replacement = `      {/* Request Refund Modal */}
      <AnimatePresence>
        {showRefundModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRefundModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl relative z-10">
              <h3 className="text-2xl font-black text-gray-900 mb-4">Request Refund</h3>
              <p className="text-sm text-gray-500 mb-6 font-medium">Please note that you can only request a refund for cancelled or returned orders.</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Reason for Refund *</label>
                  <select value={refundReason} onChange={e => setRefundReason(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all">
                    <option value="Order Cancelled">Order Cancelled</option>
                    <option value="Order Returned">Order Returned</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="mt-8 flex gap-3">
                  <button onClick={() => setShowRefundModal(false)} className="flex-1 py-4 touch-target min-h-[44px] rounded-2xl font-black uppercase tracking-widest text-[10px] border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all">
                    Close
                  </button>
                  <button onClick={handleRequestRefund} disabled={isSubmitting || !refundReason} className="flex-2 py-4 touch-target min-h-[44px] bg-pink-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-pink-500/20 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-50">
                    {isSubmitting ? 'Requesting...' : 'Confirm Refund'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Return Modal */}`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
  } else {
    console.log('Could not find ' + 'target');
  }

  fs.writeFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/Profile.tsx', content);

}

runRefactor();
