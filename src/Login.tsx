import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './store';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from './components/Logo';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [tempFirebaseUser, setTempFirebaseUser] = useState<any>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize phone number: remove spaces, dashes, etc.
    let formattedNumber = phoneNumber.trim().replace(/\s+/g, '');
    
    // If it doesn't start with +, and is 10 digits, assume it's an Indian number and prepend +91
    if (!formattedNumber.startsWith('+')) {
      if (formattedNumber.length === 10 && /^\d+$/.test(formattedNumber)) {
        formattedNumber = `+91${formattedNumber}`;
      } else {
        toast.error('Please include your country code starting with + (e.g., +91 for India)');
        return;
      }
    }

    if (formattedNumber.length < 10 || !/^\+\d+$/.test(formattedNumber)) {
      toast.error('Please enter a valid phone number with country code');
      return;
    }

    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
      toast.success('OTP sent to your mobile!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-phone-number') {
        toast.error('Invalid phone number format. Please include country code.');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('SMS is not enabled for this region. Please enable Phone Auth and allow your region in Firebase Console.', { duration: 6000 });
      } else {
        toast.error('Failed to send OTP. Please try again.');
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      if (!confirmationResult) throw new Error('No confirmation result');
      const result = await confirmationResult.confirm(otp);
      const firebaseUser = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // New user - need to collect name
        setTempFirebaseUser(firebaseUser);
        setShowNameInput(true);
        setShowOtpInput(false);
      } else {
        // Existing user
        await syncUserToFirestore(firebaseUser);
        toast.success('Successfully logged in!');
        navigate('/');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || displayName.length < 2) {
      toast.error('Please enter your full name');
      return;
    }

    setLoading(true);
    try {
      if (!tempFirebaseUser) throw new Error('No temporary user session');
      await syncUserToFirestore(tempFirebaseUser, displayName);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to complete signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const syncUserToFirestore = async (firebaseUser: any, providedName?: string) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const newUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        displayName: providedName || firebaseUser.displayName || `User ${firebaseUser.phoneNumber?.slice(-4)}`,
        photoURL: firebaseUser.photoURL || '',
        role: firebaseUser.email === 'vk311779@gmail.com' ? 'admin' : 'customer',
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newUser);
      setUser(newUser as any);
    } else {
      const userData = userSnap.data() as any;
      if (firebaseUser.email === 'vk311779@gmail.com' && userData.role !== 'admin') {
        userData.role = 'admin';
        await setDoc(userRef, { role: 'admin' }, { merge: true });
      }
      setUser(userData);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user);
      toast.success('Successfully logged in!');
      navigate('/');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login process was cancelled (popup closed).');
      } else {
        toast.error('Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-gray-50">
      <div id="recaptcha-container"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <Logo className="scale-125" />
            </Link>
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">
            {showNameInput ? 'One last step' : showOtpInput ? 'Verify OTP' : isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-gray-500 font-medium">
            {showNameInput ? 'Tell us your name to get started' : showOtpInput ? `Enter code sent to ${phoneNumber}` : isSignup ? 'Join ViBa Mart today' : 'Access your orders, wishlist and more'}
          </p>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {showNameInput ? (
              <motion.div
                key="name-input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <form className="space-y-4" onSubmit={handleCompleteSignup}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-bold placeholder:text-gray-300"
                      required
                      autoFocus
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black hover:bg-primary-hover shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Creating account...' : 'Complete Signup'}
                    {!loading && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                </form>

                <button 
                  onClick={() => {
                    setShowNameInput(false);
                    setTempFirebaseUser(null);
                    setShowOtpInput(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors pt-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel & Restart
                </button>
              </motion.div>
            ) : !showOtpInput ? (
              <motion.div
                key="login-options"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 text-gray-700 px-6 py-4 rounded-2xl font-bold hover:bg-blue-50 hover:border-blue-100 transition-all disabled:opacity-50 group"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
                  {loading ? 'Signing in...' : 'Continue with Google'}
                </button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-blue-50"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-gray-400 font-black tracking-widest text-[10px]">Or continue with phone</span>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleRequestOtp}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 00000 00000"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-bold placeholder:text-gray-300"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black hover:bg-primary-hover shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Sending...' : isSignup ? 'Sign Up with OTP' : 'Request OTP'}
                  </button>
                </form>

                <div className="text-center mt-6">
                  <button 
                    onClick={() => setIsSignup(!isSignup)}
                    className="text-sm font-bold text-primary hover:underline transition-all"
                  >
                    {isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp-input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <form className="space-y-4" onSubmit={handleVerifyOtp}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Enter 6-Digit OTP</label>
                    <input 
                      type="text" 
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="· · · · · ·"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-black text-2xl text-center tracking-[0.5em] placeholder:text-gray-200"
                      required
                      autoFocus
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </form>

                <button 
                  onClick={() => setShowOtpInput(false)}
                  className="w-full flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change Phone Number
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 font-bold tracking-tight">
          By continuing, you agree to ViBa Mart's <Link to="/terms" className="text-primary underline decoration-primary/30">Terms of Service</Link> and <Link to="/privacy" className="text-primary underline decoration-primary/30">Privacy Policy</Link>
        </p>
      </motion.div>
    </div>
  );
}

// No additional code below this line
