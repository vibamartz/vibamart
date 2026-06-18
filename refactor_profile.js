const fs = require('fs');

async function runRefactor() {
  let content = fs.readFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/Profile.tsx', 'utf-8');

  const state_target = `  const [returnRequests, setReturnRequests] = useState<Record<string, string>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);`;

  const state_replacement = `  const [returnRequests, setReturnRequests] = useState<Record<string, string>>({});
  const [refundRequests, setRefundRequests] = useState<Record<string, string>>({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('Order Cancelled/Returned');
  const [showCancelModal, setShowCancelModal] = useState(false);`;

  const fetch_target = `    // Fetch Return Requests
    const returnsQuery = query(
      collection(db, 'returns'),
      where('userId', '==', user.uid)
    );
    const unsubReturns = onSnapshot(returnsQuery, (snapshot) => {
      const returnsData: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        returnsData[data.orderId] = data.status;
      });
      setReturnRequests(returnsData);
    });`;

  const fetch_replacement = `    // Fetch Return and Refund Requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('userId', '==', user.uid)
    );
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const returnsData: Record<string, string> = {};
      const refundsData: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'return') {
            returnsData[data.orderId] = data.status;
        } else if (data.type === 'refund') {
            refundsData[data.orderId] = data.status;
        }
      });
      setReturnRequests(returnsData);
      setRefundRequests(refundsData);
    });`;

  const cancel_target = `    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ orderId: selectedOrderId, reason: cancelReason })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Order cancelled successfully');
        setShowCancelModal(false);
        setSelectedOrderId(null);
        setCancelReason('');
      } else {
        toast.error(data.error || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {`;

  const cancel_replacement = `    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ orderId: selectedOrderId, reason: cancelReason })
      });
      let data;
      try { data = await response.json(); } catch (e) { throw new Error('Server returned an invalid response.'); }
      if (data.success) {
        toast.success('Order cancelled successfully');
        setShowCancelModal(false);
        setSelectedOrderId(null);
        setCancelReason('');
      } else {
        toast.error(data.error || 'Failed to cancel order');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during cancellation');
    } finally {`;

  const return_target = `    try {
      const uploadedImageUrls = await Promise.all(returnImages.map(async (imgBase64, index) => {
        const imageRef = ref(storage, \`returns/\${selectedOrderId}_\${Date.now()}_\${index}\`);
        await uploadString(imageRef, imgBase64, 'data_url');
        return await getDownloadURL(imageRef);
      }));

      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/returns/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ 
          orderId: selectedOrderId, 
          productIds: selectedReturnProducts,
          reason: returnReason,
          comments: returnComments,
          images: uploadedImageUrls 
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Return requested successfully');
        setShowReturnModal(false);
        setSelectedOrderId(null);
        setReturnReason('Wrong Product Received');
        setReturnComments('');
        setReturnImages([]);
        setSelectedReturnProducts([]);
      } else {
        toast.error(data.error || 'Failed to request return');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {`;

  const return_replacement = `    try {
      const uploadedImageUrls = await Promise.all(returnImages.map(async (imgBase64, index) => {
        const imageRef = ref(storage, \`returns/\${selectedOrderId}_\${Date.now()}_\${index}\`);
        await uploadString(imageRef, imgBase64, 'data_url');
        return await getDownloadURL(imageRef);
      }));

      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/returns/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ 
          orderId: selectedOrderId, 
          productIds: selectedReturnProducts,
          reason: returnReason,
          comments: returnComments,
          images: uploadedImageUrls 
        })
      });
      let data;
      try { data = await response.json(); } catch (e) { throw new Error('Server returned an invalid response.'); }
      if (data.success) {
        toast.success('Return requested successfully');
        setShowReturnModal(false);
        setSelectedOrderId(null);
        setReturnReason('Wrong Product Received');
        setReturnComments('');
        setReturnImages([]);
        setSelectedReturnProducts([]);
      } else {
        toast.error(data.error || 'Failed to request return');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during return request');
    } finally {`;

  const refund_handler = `  const handleRequestRefund = async () => {
    if (!selectedOrderId || !refundReason) {
      toast.error('Please fill required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${idToken}\`
        },
        body: JSON.stringify({ 
          orderId: selectedOrderId, 
          reason: refundReason
        })
      });
      let data;
      try { data = await response.json(); } catch (e) { throw new Error('Server returned an invalid response.'); }
      if (data.success) {
        toast.success('Refund requested successfully');
        setShowRefundModal(false);
        setSelectedOrderId(null);
        setRefundReason('');
      } else {
        toast.error(data.error || 'Failed to request refund');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during refund request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {`;

  const buttons_target = `                                  {returnRequests[order.id] && (
                                    <span className="px-4 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-purple-100 flex items-center gap-2">
                                      Return: {returnRequests[order.id].replace('_', ' ')}
                                    </span>
                                  )}
                                  <Link 
                                    to={\`/track-order/\${order.id}\`}`;

  const buttons_replacement = `                                  {returnRequests[order.id] && (
                                    <span className="px-4 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-purple-100 flex items-center gap-2">
                                      Return: {returnRequests[order.id].replace('_', ' ')}
                                    </span>
                                  )}
                                  {['cancelled', 'returned'].includes(order.status) && !refundRequests[order.id] && order.paymentStatus !== 'refunded' && (
                                    <button
                                      onClick={() => { setSelectedOrderId(order.id); setShowRefundModal(true); }}
                                      className="px-6 py-2.5 bg-pink-50 text-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all border border-pink-100 flex items-center gap-2"
                                    >
                                      Request Refund
                                    </button>
                                  )}
                                  {refundRequests[order.id] && (
                                    <span className="px-4 py-2.5 bg-pink-50 text-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-pink-100 flex items-center gap-2">
                                      Refund: {refundRequests[order.id].replace('_', ' ')}
                                    </span>
                                  )}
                                  <Link 
                                    to={\`/track-order/\${order.id}\`}`;

  if (content.includes(state_target)) {
    content = content.replace(state_target, state_replacement);
  } else {
    console.log('Could not find ' + 'state_target');
  }

  if (content.includes(fetch_target)) {
    content = content.replace(fetch_target, fetch_replacement);
  } else {
    console.log('Could not find ' + 'fetch_target');
  }

  if (content.includes(cancel_target)) {
    content = content.replace(cancel_target, cancel_replacement);
  } else {
    console.log('Could not find ' + 'cancel_target');
  }

  if (content.includes(return_target)) {
    content = content.replace(return_target, return_replacement);
  } else {
    console.log('Could not find ' + 'return_target');
  }

  if (content.includes(buttons_target)) {
    content = content.replace(buttons_target, buttons_replacement);
  } else {
    console.log('Could not find ' + 'buttons_target');
  }

  fs.writeFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/Profile.tsx', content);

}

runRefactor();
