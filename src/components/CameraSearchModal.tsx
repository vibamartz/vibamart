import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Image as ImageIcon, ScanLine, Loader2, Search } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export default function CameraSearchModal({ isOpen, onClose, onSearch }: Props) {
  const [activeTab, setActiveTab] = useState<'barcode' | 'ai'>('ai');
  const [isScanning, setIsScanning] = useState(false);
  const [processingState, setProcessingState] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<string>('');
  
  const videoRef = useRef<HTMLDivElement>(null);
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<HTMLImageElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Stop scanner when changing tabs or closing
  const stopScanner = async () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      try {
        await html5QrCode.current.stop();
      } catch (e) {
        console.error("Failed to stop scanner", e);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setPreviewUrl(null);
      setProcessingState('');
      setScannedResult('');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const startBarcodeScanner = async () => {
    if (!videoRef.current) return;
    try {
      if (!html5QrCode.current) {
        html5QrCode.current = new Html5Qrcode("reader");
      }
      setIsScanning(true);
      await html5QrCode.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          setIsScanning(false);
          toast.success("Barcode found!");
          onSearch(decodedText);
          onClose();
        },
        (errorMessage) => {
          // Continuous scanning errors are expected, ignore them
        }
      );
    } catch (err) {
      toast.error("Failed to start camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const processImage = async (file: File) => {
    setPreviewUrl(URL.createObjectURL(file));
    setProcessingState('Initializing AI Model...');
    
    try {
      // 1. Ensure TF backend is ready
      await tf.ready();
      
      // 2. Load MobileNet
      const model = await mobilenet.load();
      
      // 3. Load image element
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));
      
      setProcessingState('Analyzing image...');
      // 4. Classify Image
      const predictions = await model.classify(img);
      const topTags = predictions
        .filter(p => p.probability > 0.1)
        .map(p => p.className.split(',')[0].toLowerCase());
      
      setProcessingState('Scanning for text (OCR)...');
      // 5. OCR with Tesseract
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      const cleanText = text.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
      const extractedWords = cleanText.split(' ').filter(w => w.length > 3).slice(0, 3);
      
      // 6. Combine keywords
      const finalKeywords = [...new Set([...topTags, ...extractedWords])].join(' ');
      
      if (!finalKeywords) {
        toast.error("Couldn't identify the product clearly.");
        setProcessingState('');
        return;
      }

      setScannedResult(finalKeywords);
      setProcessingState('');
      toast.success("Image processed successfully!");
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to process image.");
      setProcessingState('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleSearchSubmit = () => {
    if (scannedResult) {
      onSearch(scannedResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Visual Search</h2>
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Find products using your camera</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => { setActiveTab('ai'); stopScanner(); setIsScanning(false); }}
              className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'ai' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" /> AI Match
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('barcode'); setPreviewUrl(null); }}
              className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'barcode' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className="flex items-center justify-center gap-2">
                <ScanLine className="w-4 h-4" /> Barcode
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'barcode' ? (
              <div className="flex flex-col items-center">
                <div 
                  id="reader" 
                  ref={videoRef}
                  className="w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden mb-6 shadow-inner relative"
                >
                  {!isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <ScanLine className="w-12 h-12 text-gray-700" />
                    </div>
                  )}
                </div>
                {!isScanning ? (
                  <button 
                    onClick={startBarcodeScanner}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" /> Start Scanner
                  </button>
                ) : (
                  <button 
                    onClick={() => { stopScanner(); setIsScanning(false); }}
                    className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-rose-100 transition-all"
                  >
                    Stop Scanner
                  </button>
                )}
                <p className="text-center text-xs text-gray-400 font-bold mt-4 px-8">Point your camera at a product's barcode or QR code to search.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  className="hidden" 
                />
                
                {previewUrl ? (
                  <div className="w-full relative">
                    <img 
                      ref={imagePreviewRef} 
                      src={previewUrl} 
                      className="w-full h-64 object-cover rounded-2xl shadow-md border border-gray-100" 
                      alt="Preview" 
                    />
                    {processingState && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-white p-6">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                        <p className="font-black tracking-widest uppercase text-sm text-center">{processingState}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full h-64 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/50 hover:border-primary/50 transition-all group"
                  >
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-4 shadow-sm border border-blue-100">
                      <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <p className="font-black text-primary text-sm uppercase tracking-widest">Tap to Take Photo</p>
                    <p className="text-xs font-bold text-gray-400 mt-2">or select from gallery</p>
                  </div>
                )}

                {scannedResult && !processingState && (
                  <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Detected Keywords</p>
                      <p className="font-medium text-emerald-900">{scannedResult}</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setPreviewUrl(null); setScannedResult(''); imageInputRef.current?.click(); }}
                        className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-100 transition-all border border-gray-200"
                      >
                        Retake
                      </button>
                      <button 
                        onClick={handleSearchSubmit}
                        className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                      >
                        <Search className="w-4 h-4" /> Search Products
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
