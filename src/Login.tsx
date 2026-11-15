import React, { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from './backend/firebase/firebase';
import { signInWithCustomToken, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './backend/store';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CheckCircle2, RefreshCw, User as UserIcon, Mail, ShieldCheck, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from './desktop/components/Logo';
import axios from 'axios';
import { ViBaPermissionManager } from './services/ViBaPermissionManager';

type Step = 'auth' | 'otp' | 'profile';
type Mode = 'login' | 'signup';

const RESEND_DELAY = 60;

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('auth');
  const [loading, setLoading] = useState(false);

  // Email Auth
  const [emailAddress, setEmailAddress] = useState('');

  // OTP – 6 individual digit boxes
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend timer
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Profile (signup)
  const [displayName, setDisplayName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Firebase Auth
  const [tempFirebaseUser, setTempFirebaseUser] = useState<any>(null);
  const isVerifyingRef = useRef(false);
  const isSendingRef = useRef(false);

  const navigate = useNavigate();
  const { user, loading: authLoading, setUser } = useAuthStore();

  // Redirect immediately if already logged in so the Login page is never displayed to authenticated users
  useEffect(() => {
    if (user && !authLoading && step !== 'profile') {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, step, navigate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (step === 'otp') {
      ViBaPermissionManager.requestSmsOtpAutofill().then(code => {
        if (code && code.length === 6) {
          setOtpDigits(code.split(''));
          toast.success('SMS OTP autofilled securely!');
        }
      });
    }
  }, [step]);


  const startResendTimer = () => {
    setResendTimer(RESEND_DELAY);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const sendOtp = async (isResend = false) => {
    if (loading) return;
    const cleanEmail = emailAddress.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Please enter your Gmail address.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/send-email-otp', { email: cleanEmail });
      if (response.data && response.data.success) {
        setStep('otp');
        setOtpDigits(['', '', '', '', '', '']);
        startResendTimer();
        toast.success(
          isResend
            ? 'OTP resent to your Gmail address!'
            : 'OTP sent to your Gmail address! Please check your inbox.'
        );
        setTimeout(() => otpRefs.current[0]?.focus(), 200);
      } else {
        const errorMsg = response.data?.error || response.data?.message || 'Failed to send OTP';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error("sendOtp Error:", err);
      const rawMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send OTP';
      const msg = typeof rawMsg === 'string' && rawMsg.includes('<html')
        ? 'Server communication error. Please try again.'
        : rawMsg;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    await sendOtp(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      // User pasted or autofilled multi-digit OTP into input
      const newDigits = [...otpDigits];
      const chars = digitsOnly.slice(0, 6).split('');
      chars.forEach((c, i) => {
        if (index + i < 6) {
          newDigits[index + i] = c;
        }
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + chars.length, 5);
      otpRefs.current[nextFocus]?.focus();
      return;
    }

    const digit = digitsOnly.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = ['', '', '', '', '', ''];
      pasted.split('').forEach((char, idx) => {
        if (idx < 6) newDigits[idx] = char;
      });
      setOtpDigits(newDigits);
      const focusIndex = Math.min(pasted.length, 5);
      otpRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    const cleanEmail = emailAddress.trim().toLowerCase();
    const otpCode = otpDigits.join('').replace(/\D/g, '');
    if (otpCode.length < 6) {
      toast.error('Please enter the complete 6-digit OTP received on your Gmail.');
      const firstEmptyIndex = otpDigits.findIndex(d => !d);
      if (firstEmptyIndex !== -1) {
        otpRefs.current[firstEmptyIndex]?.focus();
      }
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/verify-email-otp', { email: cleanEmail, code: otpCode });

      if (response.data && response.data.success) {
        let firebaseUser: any = null;

        // 1. If backend returned customToken, sign in with it
        if (response.data.customToken) {
          try {
            const result = await signInWithCustomToken(auth, response.data.customToken);
            firebaseUser = result.user;
          } catch (tokenErr) {
            console.warn("Custom token sign-in notice:", tokenErr);
          }
        }

        // 2. If no customToken or it failed, try client authSecret
        if (!firebaseUser && response.data.authSecret) {
          const targetEmail = response.data.email || cleanEmail;
          try {
            const result = await signInWithEmailAndPassword(auth, targetEmail, response.data.authSecret);
            firebaseUser = result.user;
          } catch (authErr: any) {
            if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-login-credentials') {
              try {
                const result = await createUserWithEmailAndPassword(auth, targetEmail, response.data.authSecret);
                firebaseUser = result.user;
              } catch (createErr: any) {
                console.warn("Firebase Auth create user notice:", createErr.code);
              }
            }
          }
        }

        // 3. Fallback: If Firebase client Auth couldn't sign in (e.g. existing Google sign-in user with different credentials)
        // Since OTP is 100% verified by backend, create/use the authenticated session object
        if (!firebaseUser) {
          const deterministicUid = response.data.uid || ('usr_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
          firebaseUser = {
            uid: deterministicUid,
            email: cleanEmail,
            displayName: cleanEmail.split('@')[0],
            phoneNumber: '',
            photoURL: '',
            emailVerified: true,
          };
        }

        if (mode === 'signup') {
          setTempFirebaseUser(firebaseUser);
          setStep('profile');
          toast.success('Email verified successfully! Please complete your profile.');
        } else {
          syncUser(firebaseUser);
          toast.success('Login successful! Welcome back.');
          navigate('/', { replace: true });
        }
      } else {
        throw new Error(response.data?.error || 'Invalid OTP code. Please check your Gmail and try again.');
      }
    } catch (err: any) {
      console.error("verifyOtp Error:", err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to verify OTP';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      syncUser(firebaseUser);
      toast.success(`Login successful! Welcome ${firebaseUser.displayName || ''}`.trim());
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      if (error?.code === 'auth/popup-closed-by-user') {
        toast.error('Google Sign-In was cancelled.');
      } else if (error?.code === 'auth/popup-blocked') {
        toast.error('Sign-in popup was blocked by browser. Please allow popups.');
      } else if (error?.code === 'auth/unauthorized-domain') {
        toast.error('Domain not authorized in Firebase Console.');
      } else if (error?.code === 'auth/operation-not-allowed') {
        toast.error('Google Sign-In is not enabled in Firebase Console.');
      } else {
        const msg = error?.message || 'Login failed. Please try again.';
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || displayName.trim().length < 2) {
      toast.warning('Please enter your full name');
      return;
    }
    if (!contactNumber || contactNumber.trim().length < 7) {
      toast.warning('Please enter a valid contact number');
      return;
    }
    setLoading(true);
    try {
      if (!tempFirebaseUser) throw new Error('No temp user');
      syncUser(tempFirebaseUser, displayName.trim(), contactNumber.trim());
      toast.success('Your account has been created successfully.');
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const syncUser = (firebaseUser: any, providedName?: string, providedPhone?: string) => {
    const now = new Date().toISOString();
    const userEmail = firebaseUser.email || emailAddress || '';

    const fallbackUser: any = {
      uid: firebaseUser.uid,
      email: userEmail,
      displayName: providedName || firebaseUser.displayName || (userEmail ? userEmail.split('@')[0] : `User ${Math.floor(Math.random() * 10000)}`),
      phone: providedPhone || firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      role: userEmail === 'vk311779@gmail.com' ? 'super_admin' : 'customer',
      isVerified: true,
      accountStatus: 'active',
      createdAt: now,
      lastLoginAt: now,
    };

    // Immediately update auth store so the session is active instantly
    setUser(fallbackUser);

    // Asynchronously background sync user doc with Firestore without blocking navigation
    (async () => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, fallbackUser, { merge: true });
        } else {
          const userData = userSnap.data() as any;
          const isAdmin = (userEmail === 'vk311779@gmail.com' || userData.email === 'vk311779@gmail.com');

          const updateData: any = {
            isVerified: true,
            accountStatus: 'active',
            lastLoginAt: now,
          };

          if (isAdmin && userData.role !== 'admin' && userData.role !== 'super_admin') {
            updateData.role = 'super_admin';
            userData.role = 'super_admin';
          }

          if (providedPhone && !userData.phone) {
            updateData.phone = providedPhone;
            userData.phone = providedPhone;
          }
          if (providedName && (!userData.displayName || userData.displayName.startsWith('User '))) {
            updateData.displayName = providedName;
            userData.displayName = providedName;
          }

          await setDoc(userRef, updateData, { merge: true });
          userData.isVerified = true;
          userData.accountStatus = 'active';
          userData.lastLoginAt = now;
          setUser({ ...fallbackUser, ...userData, ...updateData });
        }
      } catch (fsErr) {
        console.warn("[Firestore] User document sync error, continuing with auth session:", fsErr);
      }
    })();
  };

  const otpCode = otpDigits.join('');
  const isOtpComplete = otpCode.length === 6;

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-3xl shadow-2xl shadow-green-100/60 border border-green-100/80 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400" />

          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-8">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <Logo className="scale-125" showTextOnMobile={true} />
              </Link>
            </div>

            <AnimatePresence mode="wait">
              {step === 'auth' && (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
                    {(['login', 'signup'] as Mode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${mode === m
                          ? 'bg-white text-green-700 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                          }`}
                      >
                        {m === 'login' ? 'Log In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>

                  <h2 className="text-2xl font-black text-gray-900 mb-1">
                    {mode === 'login' ? 'Welcome back! 👋' : 'Create account 🎉'}
                  </h2>
                  <p className="text-gray-400 text-sm font-medium mb-8">
                    {mode === 'login'
                      ? 'Sign in to access your orders & wishlist'
                      : 'Join ViBa Mart and start shopping today'}
                  </p>

                  <form onSubmit={handleRequestOtp} noValidate className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                          type="email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRequestOtp();
                            }
                          }}
                          placeholder="you@gmail.com"
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-3.5 focus:outline-none focus:border-green-400 focus:ring-4 focus:ring-green-50 transition-all font-bold placeholder:text-gray-300 text-gray-900"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Mail className="w-5 h-5" />
                      {loading ? 'Sending OTP...' : 'Get OTP'}
                    </button>
                  </form>

                  <div className="mt-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-xs font-bold text-gray-400 uppercase">OR</span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="mt-6 w-full bg-white border-2 border-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </button>


                  <p className="mt-6 text-center text-[11px] text-gray-400 font-medium leading-relaxed">
                    By continuing, you agree to ViBa Mart's{' '}
                    <Link to="/terms" className="text-green-600 underline decoration-green-200">Terms</Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-green-600 underline decoration-green-200">Privacy Policy</Link>
                  </p>
                </motion.div>
              )}

              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                      <ShieldCheck className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-gray-900 text-center mb-1">Verify OTP</h2>
                  <p className="text-gray-400 text-sm font-medium text-center mb-8">
                    Enter the 6-digit code sent to{' '}
                    <span className="text-gray-700 font-bold">{emailAddress}</span>
                  </p>

                  <form onSubmit={handleVerifyOtp} noValidate className="space-y-6">
                    <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className={`w-11 h-14 text-center text-xl font-black rounded-2xl border-2 transition-all focus:outline-none
                            ${digit
                              ? 'border-green-400 bg-green-50 text-green-700 focus:ring-4 focus:ring-green-100'
                              : 'border-gray-100 bg-gray-50 text-gray-900 focus:border-green-400 focus:ring-4 focus:ring-green-50'
                            }`}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      onClick={handleVerifyOtp}
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {loading ? 'Verifying OTP...' : 'Send OTP to Verify'}
                    </button>
                  </form>

                  <div className="flex items-center justify-center mt-6 gap-2">
                    {resendTimer > 0 ? (
                      <p className="text-sm text-gray-400 font-medium">
                        Resend OTP in{' '}
                        <span className="font-black text-green-600 tabular-nums">{resendTimer}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={() => sendOtp(true)}
                        disabled={loading}
                        className="flex items-center gap-2 text-sm font-bold text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setStep('auth');
                      setOtpDigits(['', '', '', '', '', '']);
                      if (timerRef.current) clearInterval(timerRef.current);
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Change Email
                  </button>
                </motion.div>
              )}

              {step === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-emerald-600" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-gray-900 text-center mb-1">One last step 🙌</h2>
                  <p className="text-gray-400 text-sm font-medium text-center mb-8">
                    Tell us a little about yourself to complete your account
                  </p>

                  <form onSubmit={handleCompleteProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-3.5 focus:outline-none focus:border-green-400 focus:ring-4 focus:ring-green-50 transition-all font-bold placeholder:text-gray-300 text-gray-900"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                        Contact Number <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        <input
                          type="tel"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-3.5 focus:outline-none focus:border-green-400 focus:ring-4 focus:ring-green-50 transition-all font-bold placeholder:text-gray-300 text-gray-900"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || displayName.trim().length < 2 || contactNumber.trim().length < 7}
                      className="w-full bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {loading ? 'Creating account...' : 'Complete Sign Up'}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setStep('auth');
                      setTempFirebaseUser(null);
                      setOtpDigits(['', '', '', '', '', '']);
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-gray-600 transition-colors py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel & Restart
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 font-medium mt-4">
          🔒 Secured by Google Firebase
        </p>
      </motion.div>
    </div>
  );
}
