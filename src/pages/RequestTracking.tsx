import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { 
  ArrowLeft, Clock, ShieldCheck, CheckCircle2, AlertCircle, 
  CreditCard, Calendar, Truck, FileText, Loader2, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

// Status styling and labelling maps
const CANCELLATION_STEPS = [
  { status: 'requested', label: 'Pending Review', icon: Clock, color: 'text-amber-500', desc: 'Admin is reviewing your cancellation request.' },
  { status: 'approved', label: 'Approved', icon: ShieldCheck, color: 'text-blue-500', desc: 'Cancellation request approved.' },
  { status: 'cancelled', label: 'Order Cancelled', icon: CheckCircle2, color: 'text-gray-600', desc: 'The order has been cancelled successfully.' },
  { status: 'refund_initiated', label: 'Refund Initiated', icon: RefreshCw, color: 'text-indigo-500', desc: 'Refund has been initiated by the bank.' },
  { status: 'refund_completed', label: 'Refund Completed', icon: CreditCard, color: 'text-emerald-500', desc: 'Refund successfully completed!' }
];

const RETURN_STEPS = [
  { status: 'requested', label: 'Return Requested', icon: FileText, color: 'text-orange-500', desc: 'We have received your return request.' },
  { status: 'approved', label: 'Approved', icon: ShieldCheck, color: 'text-blue-500', desc: 'Return request approved.' },
  { status: 'pickup_scheduled', label: 'Pickup Scheduled', icon: Truck, color: 'text-purple-500', desc: 'Return package pickup is scheduled.' },
  { status: 'product_received', label: 'Product Received', icon: CheckCircle2, color: 'text-indigo-500', desc: 'Product returned to warehouse.' },
  { status: 'quality_check', label: 'Quality Check', icon: RefreshCw, color: 'text-yellow-600', desc: 'Performing quality inspection.' },
  { status: 'refund_initiated', label: 'Refund Initiated', icon: Clock, color: 'text-blue-600', desc: 'Refund has been initiated.' },
  { status: 'refund_completed', label: 'Refund Completed', icon: CreditCard, color: 'text-emerald-500', desc: 'Refund processed to original payment method.' }
];

const REFUND_STEPS = [
  { status: 'requested', label: 'Refund Requested', icon: FileText, color: 'text-pink-500', desc: 'We have received your refund request.' },
  { status: 'under_review', label: 'Under Review', icon: Clock, color: 'text-amber-500', desc: 'Refund request is under review.' },
  { status: 'approved', label: 'Approved', icon: ShieldCheck, color: 'text-blue-500', desc: 'Refund request approved.' },
  { status: 'processing', label: 'Processing', icon: RefreshCw, color: 'text-indigo-500', desc: 'Refund is being processed by payment gateway.' },
  { status: 'refund_sent', label: 'Refund Sent', icon: Clock, color: 'text-blue-600', desc: 'Refund sent to your bank.' },
  { status: 'refund_completed', label: 'Refund Completed', icon: CreditCard, color: 'text-emerald-500', desc: 'Refund completed successfully.' }
];

export default function RequestTracking() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(requestId || '');
  const navigate = useNavigate();

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe: (() => void) | null = null;

    async function initTracking() {
      try {
        const dbCollections = ["cancellation_requests", "return_requests", "refund_requests"];
        let foundRef = null;
        let foundType = "";

        for (const colName of dbCollections) {
          try {
            const docRef = doc(db, colName, requestId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              foundRef = docRef;
              if (colName === "cancellation_requests") {
                foundType = "cancellation";
              } else if (colName === "return_requests") {
                foundType = "return";
              } else {
                foundType = "refund";
              }
              break;
            }
          } catch (loopErr) {
            handleFirestoreError(loopErr, OperationType.GET, `${colName}/${requestId}`, false);
          }
        }

        if (foundRef) {
          unsubscribe = onSnapshot(foundRef, (docSnap) => {
            if (docSnap.exists()) {
              setRequest({ id: docSnap.id, type: foundType, ...docSnap.data() });
            } else {
              setError("Request not found. Please verify the Request ID.");
              setRequest(null);
            }
            setLoading(false);
          }, (err) => {
            console.error("Firestore listener error:", err);
            handleFirestoreError(err, OperationType.GET, foundRef?.path || `requests/${requestId}`, false);
            setError("Failed to load tracking updates. Access may be unauthorized.");
            setLoading(false);
          });
        } else {
          setError("Request not found. Please verify the Request ID.");
          setRequest(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error finding tracking document:", err);
        handleFirestoreError(err, OperationType.GET, `requests/${requestId}`, false);
        setError("An error occurred while loading request updates.");
        setLoading(false);
      }
    }

    initTracking();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [requestId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/track-request/${searchInput.trim()}`);
    }
  };

  const getTimelineSteps = (type: string) => {
    if (type === 'cancellation') return CANCELLATION_STEPS;
    if (type === 'return') return RETURN_STEPS;
    return REFUND_STEPS;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading request timeline...</p>
        </div>
      </div>
    );
  }

  if (!requestId || error) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-gray-100"
        >
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Track Request</h2>
          <p className="text-gray-500 mb-8 font-medium">Enter your Cancellation, Return, or Refund Request ID to check status.</p>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-2 text-sm font-bold text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSearch} className="space-y-4">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Request ID (e.g. U7r3y...)"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all font-bold text-center"
              required
            />
            <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-primary-hover transition-all">
              Track Progress
            </button>
          </form>

          <Link to="/profile?tab=requests" className="inline-block mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary transition-colors">
            Back to Request History
          </Link>
        </motion.div>
      </div>
    );
  }

  const type = request.type || request.requestType || 'refund';
  const status = request.status || 'requested';
  const steps = getTimelineSteps(type);
  
  // Find current index
  let currentStepIndex = steps.findIndex(s => s.status === status);
  if (currentStepIndex === -1) {
    if (status === 'rejected') {
      currentStepIndex = 0; // Show rejected custom timeline
    } else if (status === 'refund_processed') {
      currentStepIndex = steps.length - 1; // map refund_processed to final step
    } else {
      currentStepIndex = 0;
    }
  }

  const isRejected = status === 'rejected';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/profile?tab=requests" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary font-black uppercase tracking-widest text-[10px] mb-8 transition-colors group">
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to My Requests
        </Link>

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
          
          {/* Header Card */}
          <div className="p-8 md:p-12 border-b border-gray-100 bg-gray-900 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Request Status Tracker</p>
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-3xl font-black tracking-tight select-all">#{request.requestId || request.id}</h1>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    isRejected ? 'bg-red-100 text-red-600' : 'bg-primary/20 text-blue-400'
                  }`}>
                    {isRejected ? 'Rejected' : steps[currentStepIndex]?.label || status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Request Type</p>
                <p className="text-lg font-black uppercase tracking-wider text-blue-400 mb-4">{type}</p>
                
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Submitted Date</p>
                <p className="text-xs font-bold text-gray-300">
                  {new Date(request.createdDate || request.createdAt).toLocaleDateString(undefined, { 
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            
            {/* Visual Timeline and Progress Bar */}
            {!isRejected ? (
              <div className="relative mb-28 mt-8 px-4">
                {/* Horizontal Progress Bar Background */}
                <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-100 -translate-y-1/2 rounded-full" />
                {/* Filled Progress Bar */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                  className="absolute top-1/2 left-0 h-1.5 bg-primary -translate-y-1/2 rounded-full z-10"
                />
                
                {/* Steps Nodes */}
                <div className="relative flex justify-between z-20">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div key={step.status} className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md ${
                          isCompleted ? 'bg-primary text-white rotate-0' : 'bg-white text-gray-300 border border-gray-100 rotate-12'
                        } ${isCurrent ? 'scale-125 z-30 ring-4 ring-primary/20 shadow-lg' : 'scale-100'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="absolute top-16 text-center whitespace-nowrap">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-gray-900' : 'text-gray-300'}`}>
                            {step.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Rejected Callout */
              <div className="bg-red-50 border border-red-100 p-6 rounded-3xl mb-12 flex gap-4 items-start">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-red-900">Request Rejected</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Your request was reviewed and rejected. Admin Notes: {request.adminNotes || "No notes provided."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-gray-100">
              
              {/* Timeline details */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Request Timeline</h3>
                  <div className="space-y-6">
                    {/* Render status transitions */}
                    {steps.map((step, index) => {
                      const isCompleted = index <= currentStepIndex && !isRejected;
                      const isCurrent = index === currentStepIndex && !isRejected;

                      return (
                        <div key={step.status} className="flex gap-4 relative">
                          {index !== steps.length - 1 && (
                            <div className="absolute top-4 left-2 w-0.5 h-full bg-gray-100 -translate-x-1/2" />
                          )}
                          <div className={`w-4 h-4 rounded-full mt-1.5 z-10 transition-colors duration-550 ${
                            isCompleted ? 'bg-primary' : 'bg-gray-200'
                          }`} />
                          <div className="flex-1">
                            <p className={`text-sm font-black ${isCompleted ? 'text-gray-900' : 'text-gray-350'}`}>{step.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Refund Tracking Details Card */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 space-y-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" /> Request Details
                  </h3>
                  
                  <div className="space-y-4 text-sm font-medium">
                    <div className="flex justify-between border-b border-gray-200/50 pb-3">
                      <span className="text-gray-500">Order ID</span>
                      <Link to={`/track-order/${request.customOrderId || request.orderId}`} className="font-bold text-primary hover:underline">
                        #{request.customOrderId || request.orderId}
                      </Link>
                    </div>

                    <div className="flex justify-between border-b border-gray-200/50 pb-3">
                      <span className="text-gray-500">Refund Amount</span>
                      <span className="font-black text-gray-900">₹{(request.refundAmount || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between border-b border-gray-200/50 pb-3">
                      <span className="text-gray-500">Refund Method</span>
                      <span className="font-bold text-gray-800 uppercase tracking-wider">{request.refundMethod || 'Original Payment Method'}</span>
                    </div>

                    <div className="flex justify-between border-b border-gray-200/50 pb-3">
                      <span className="text-gray-500">Transaction ID</span>
                      <span className="font-bold text-gray-700 italic select-all">{request.refundTransactionId || 'Awaiting Initiation'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Est. Completion</span>
                      <span className="font-black text-gray-900 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {request.estimatedCompletionDate ? (
                          new Date(request.estimatedCompletionDate).toLocaleDateString(undefined, {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })
                        ) : 'Calculating...'}
                      </span>
                    </div>
                  </div>

                  {request.adminNotes && (
                    <div className="pt-4 border-t border-gray-200 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Admin Notes</p>
                      <p className="text-xs text-gray-600 font-semibold italic">"{request.adminNotes}"</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
