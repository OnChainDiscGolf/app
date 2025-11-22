
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

// Helper Component for Success Animation
const SuccessOverlay: React.FC<{ message: string, subMessage?: string, onClose: () => void }> = ({ message, subMessage, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 2500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="absolute inset-0 z-50 bg-brand-dark flex flex-col items-center justify-center animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in-75 delay-100 duration-500">
                <Icons.CheckMark size={48} className="text-white" strokeWidth={4} />
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 animate-in slide-in-from-bottom-4 delay-200">{message}</h3>
            {subMessage && <p className="text-slate-400 text-lg animate-in slide-in-from-bottom-4 delay-300">{subMessage}</p>}
        </div>
    );
};

// Helper Component for Processing Overlay (Blocking)
const ProcessingOverlay: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div className="absolute inset-0 z-50 bg-brand-dark/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-white animate-pulse">{message}</h3>
        </div>
    );
};

export const Wallet: React.FC = () => {
  const { walletBalance, transactions, userProfile, currentUserPubkey, mints, setActiveMint, addMint, removeMint, sendFunds, receiveEcash, depositFunds, checkDepositStatus, confirmDeposit, getLightningQuote, isAuthenticated, refreshWalletBalance } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<'main' | 'receive' | 'deposit' | 'send-scan' | 'send-details' | 'mints'>('main');
  const [sendAmount, setSendAmount] = useState('');
  const [sendInput, setSendInput] = useState(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [quoteFee, setQuoteFee] = useState<number | null>(null);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [isCheckingInvoice, setIsCheckingInvoice] = useState(false);
  const [isFixedAmount, setIsFixedAmount] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const [depositAmount, setDepositAmount] = useState('1000');
  const [depositInvoice, setDepositInvoice] = useState('');
  const [depositQuote, setDepositQuote] = useState('');
  const [depositSuccess, setDepositSuccess] = useState(false);

  const [successMode, setSuccessMode] = useState<'sent' | 'received' | null>(null);

  const [newMintUrl, setNewMintUrl] = useState('');
  const [newMintName, setNewMintName] = useState('');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanner Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const safeMints = Array.isArray(mints) ? mints : [];
  const activeMint = safeMints.find(m => m.isActive) || safeMints[0];
  const receiveAddress = userProfile.lud16 || currentUserPubkey;

  // Reset state when entering main view and verify balance
  useEffect(() => {
      if (view === 'main') {
          setDepositSuccess(false);
          setDepositQuote('');
          setDepositInvoice('');
          setSendInput('');
          setSendAmount('');
          setIsProcessing(false);
          setQuoteFee(null);
          setInsufficientFunds(false);
          setIsFixedAmount(false);
          setSuccessMode(null);
          setTransactionError(null);
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          // Auto-verify wallet balance when entering main wallet screen
          refreshWalletBalance();
      }
  }, [view]);

  // Auto-Polling for Deposit Confirmation
  useEffect(() => {
      if (view === 'deposit' && depositQuote && !depositSuccess) {
          // Poll every 3 seconds
          pollingRef.current = setInterval(async () => {
              const isPaid = await checkDepositStatus(depositQuote);
              if (isPaid) {
                  if (pollingRef.current) clearInterval(pollingRef.current);
                  const amount = parseInt(depositAmount);
                  const success = await confirmDeposit(depositQuote, amount);
                  if (success) {
                      setDepositSuccess(true);
                  }
              }
          }, 3000);
      }
      return () => {
          if (pollingRef.current) clearInterval(pollingRef.current);
      };
  }, [view, depositQuote, depositSuccess, depositAmount, checkDepositStatus, confirmDeposit]);

  // Auto-Populate Invoice Details
  useEffect(() => {
      if (view !== 'send-details') return;
      if (!sendInput) {
          setQuoteFee(null);
          setInsufficientFunds(false);
          setIsFixedAmount(false);
          return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
          const input = sendInput.trim();
          
          if (input.toLowerCase().startsWith('lnbc')) {
              setIsCheckingInvoice(true);
              setTransactionError(null);
              try {
                  const { amount, fee } = await getLightningQuote(input);
                  setSendAmount(amount.toString());
                  setQuoteFee(fee);
                  setIsFixedAmount(true); 

                  if (walletBalance < (amount + fee)) {
                      setInsufficientFunds(true);
                  } else {
                      setInsufficientFunds(false);
                  }
              } catch (e) {
                  console.error("Failed to check invoice", e);
                  setQuoteFee(null);
                  setIsFixedAmount(false);
              } finally {
                  setIsCheckingInvoice(false);
              }
          } else {
              setQuoteFee(null);
              setIsFixedAmount(false);
              setInsufficientFunds(false);
          }
      }, 700);

      return () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
      };
  }, [sendInput, walletBalance, getLightningQuote]);


  // Camera & Scanning Logic
  useEffect(() => {
    if (view !== 'send-scan') return;

    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isMounted = true;

    const tick = async (jsQR: any) => {
      if (!isMounted) return;
      
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            let data = code.data;
            if (data.toLowerCase().startsWith('lightning:')) {
              data = data.substring(10);
            }
            
            if (isMounted) {
                if (data.startsWith('cashuA')) {
                    const confirmReceive = window.confirm("This looks like an eCash token. Do you want to receive (claim) it?");
                    if (confirmReceive) {
                        await handleReceiveToken(data);
                        return;
                    }
                }
                setSendInput(data);
                setView('send-details');
            }
            return; 
          }
        }
      }
      animationFrameId = requestAnimationFrame(() => tick(jsQR));
    };

    const startCamera = async () => {
        setIsCameraLoading(true);
        setCameraError(null);
        try {
            const jsQRModule = await import('https://esm.sh/jsqr@1.4.2');
            const jsQR = jsQRModule.default || jsQRModule;

            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          
            if (!isMounted) {
                mediaStream.getTracks().forEach(track => track.stop());
                return;
            }

            stream = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true'); 
                try { await videoRef.current.play(); } catch (e) {}
                
                setIsCameraLoading(false);
                requestAnimationFrame(() => tick(jsQR));
            }
        } catch (err) {
          console.error("Camera access denied or error", err);
          if (isMounted) {
             setIsCameraLoading(false);
             setCameraError("Could not access camera. Check permissions or upload an image.");
          }
        }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [view]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const jsQRModule = await import('https://esm.sh/jsqr@1.4.2');
        const jsQR = jsQRModule.default || jsQRModule;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
              
              if (code) {
                 let data = code.data;
                 if (data.toLowerCase().startsWith('lightning:')) data = data.substring(10);
                 if (data.startsWith('cashuA')) {
                    await handleReceiveToken(data);
                 } else {
                    setSendInput(data);
                    setView('send-details');
                 }
              } else {
                 alert("No QR code found in image.");
              }
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    } catch (e) {
        alert("Failed to load QR scanner module.");
    }
  };

  const handleReceiveToken = async (token: string) => {
      const success = await receiveEcash(token);
      if (success) {
          setSuccessMode('received');
      } else {
          alert("Failed to claim eCash token.");
      }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const resolveLightningAddress = async (address: string, amountSats: number): Promise<string | null> => {
      try {
          const [user, domain] = address.split('@');
          if (!user || !domain) return null;

          const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
          const data = await res.json();
          
          if (data.callback) {
              const millisats = amountSats * 1000;
              if (millisats < data.minSendable || millisats > data.maxSendable) {
                  alert(`Amount must be between ${data.minSendable/1000} and ${data.maxSendable/1000} sats`);
                  return null;
              }
              const callbackUrl = `${data.callback}${data.callback.includes('?') ? '&' : '?'}amount=${millisats}`;
              const invoiceRes = await fetch(callbackUrl);
              const invoiceData = await invoiceRes.json();
              return invoiceData.pr; 
          }
      } catch (e) {
          console.error("LN Address resolution failed", e);
      }
      return null;
  };

  const handleSend = async () => {
    const amount = parseInt(sendAmount);
    let targetInvoice = sendInput.trim();
    setTransactionError(null);

    if (!targetInvoice) {
      setTransactionError("Missing invoice or address");
      return;
    }

    if (targetInvoice.startsWith('cashuA')) {
        if (window.confirm("This looks like an eCash token. Do you want to Receive (Claim) it instead?")) {
            await handleReceiveToken(targetInvoice);
            return;
        }
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        if (targetInvoice.includes('@')) {
            setTransactionError("Please enter a valid amount");
            return;
        }
    }

    setIsProcessing(true);

    try {
        if (targetInvoice.includes('@') && !targetInvoice.startsWith('lnbc')) {
            const resolvedInvoice = await resolveLightningAddress(targetInvoice, amount);
            if (!resolvedInvoice) {
                setTransactionError("Could not resolve Lightning Address. Please check validity.");
                setIsProcessing(false);
                return;
            }
            targetInvoice = resolvedInvoice;
        }

        const success = await sendFunds(amount, targetInvoice);
        if (success) {
            setSuccessMode('sent');
        } else {
            setTransactionError("Transaction Failed. Check your balance or mint connection.");
        }
    } catch (e) {
        console.error(e);
        setTransactionError("An error occurred during payment. Details: " + (e instanceof Error ? e.message : 'Unknown'));
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleRequestDeposit = async () => {
      const amount = parseInt(depositAmount);
      if (isNaN(amount) || amount < 10) {
          alert("Minimum deposit 10 sats");
          return;
      }
      try {
          const { request, quote } = await depositFunds(amount);
          setDepositInvoice(request);
          setDepositQuote(quote); 
      } catch (e) {
          alert("Failed to contact mint.");
      }
  };

  const handleAddMint = () => {
    if (newMintUrl && newMintName) {
      addMint(newMintUrl, newMintName);
      setNewMintUrl('');
      setNewMintName('');
    }
  };

  // --- Success Overlay Renders ---

  if (depositSuccess) {
      return (
          <div className="h-full p-6 relative">
              <SuccessOverlay 
                message="Deposit Confirmed!" 
                subMessage="Tokens minted successfully." 
                onClose={() => setView('main')}
              />
          </div>
      );
  }

  if (successMode === 'sent') {
      return (
          <div className="h-full p-6 relative">
              <SuccessOverlay 
                message="Payment Sent!" 
                onClose={() => setView('main')}
              />
          </div>
      );
  }

  if (successMode === 'received') {
      return (
          <div className="h-full p-6 relative">
              <SuccessOverlay 
                message="eCash Received!" 
                onClose={() => setView('main')}
              />
          </div>
      );
  }

  // --- Sub-Views ---

  if (view === 'mints') {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center mb-6">
           <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
             <Icons.Prev />
           </button>
           <h2 className="text-xl font-bold">Manage Mints</h2>
        </div>
        <div className="space-y-4 mb-6">
           {safeMints.map(mint => (
             <div 
                key={mint.url} 
                onClick={() => setActiveMint(mint.url)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${mint.isActive ? 'bg-brand-primary/10 border-brand-primary' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
             >
               <div>
                 <div className="flex items-center space-x-2">
                   <span className="font-bold text-white">{mint.nickname}</span>
                   {mint.isActive && <Icons.CheckMark size={14} className="text-brand-primary"/>}
                 </div>
                 <div className="text-xs text-slate-400 truncate max-w-[200px]">{mint.url}</div>
               </div>
               {!mint.isActive && (
                 <button onClick={(e) => { e.stopPropagation(); removeMint(mint.url); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded">
                   <Icons.Trash size={16} />
                 </button>
               )}
             </div>
           ))}
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
           <h3 className="text-sm font-bold mb-3">Add New Mint</h3>
           <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-2 text-sm" placeholder="Mint Nickname" value={newMintName} onChange={e => setNewMintName(e.target.value)} />
           <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-3 text-sm" placeholder="Mint URL" value={newMintUrl} onChange={e => setNewMintUrl(e.target.value)} />
           <Button fullWidth onClick={handleAddMint} disabled={!newMintName || !newMintUrl}>Add Mint</Button>
        </div>
      </div>
    );
  }

  if (view === 'deposit') {
      return (
       <div className="p-6 h-full flex flex-col">
         <div className="flex items-center mb-6">
            <button onClick={() => setView('main')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
              <Icons.Prev />
            </button>
            <h2 className="text-xl font-bold">Mint Deposit</h2>
         </div>

         {!depositInvoice ? (
             <div className="space-y-4">
                 <p className="text-slate-400 text-sm">Convert Lightning (Sats) into eCash tokens.</p>
                 <label className="block text-sm font-bold text-slate-500">Amount</label>
                 <input 
                    type="number" 
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full bg-slate-800 p-4 rounded-xl text-2xl font-mono text-white border border-slate-600"
                 />
                 <Button fullWidth onClick={handleRequestDeposit}>Generate Invoice</Button>
             </div>
         ) : (
             <div className="flex flex-col items-center space-y-4 animate-in fade-in relative">
                 <h3 className="text-lg font-bold text-white">Pay this Invoice</h3>
                 <div className="bg-white p-4 rounded-xl">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositInvoice)}`} 
                        alt="Deposit Invoice" 
                        className="w-48 h-48"
                    />
                 </div>
                 <div className="w-full bg-slate-800 p-3 rounded text-xs font-mono text-slate-400 break-all">
                     {depositInvoice.substring(0, 30)}...
                 </div>
                 <Button fullWidth onClick={() => handleCopy(depositInvoice)} variant="secondary">Copy Invoice</Button>
                 
                 <div className="flex items-center space-x-2 text-brand-primary animate-pulse">
                     <Icons.Zap size={18} />
                     <span className="text-sm font-bold">Waiting for payment...</span>
                 </div>
             </div>
         )}
       </div>
      );
  }

  if (view === 'receive') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiveAddress)}&bgcolor=ffffff&color=000000&margin=2`;

    return (
       <div className="p-6 h-full flex flex-col items-center text-center">
         <div className="w-full flex justify-start mb-6">
            <button onClick={() => setView('main')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
              <Icons.Prev />
            </button>
         </div>
         <h2 className="text-2xl font-bold mb-2">Receive Sats</h2>
         <p className="text-slate-400 text-sm mb-8">Scan to send funds to this wallet</p>
         <div className="bg-white p-4 rounded-2xl shadow-xl mb-6">
            <img src={qrUrl} alt="Wallet QR Code" className="w-48 h-48" />
         </div>
         <Button fullWidth variant="secondary" onClick={() => setView('deposit')} className="mb-4">
             <Icons.Plus size={18} className="mr-2" /> Mint Tokens (Deposit)
         </Button>
         <div className="w-full max-w-xs bg-slate-800 p-3 rounded-lg flex items-center justify-between mb-4">
             <span className="text-xs text-slate-400 truncate mr-2">{receiveAddress}</span>
             <button onClick={() => handleCopy(receiveAddress)} className="text-brand-primary hover:text-white">
                <Icons.Copy size={18} />
             </button>
         </div>
       </div>
    );
  }

  if (view === 'send-scan') {
    const fileInput = (
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
    );

    if (cameraError) {
        return (
            <div className="h-full bg-brand-dark flex flex-col p-6 relative">
                <button 
                  onClick={() => setView('main')}
                  className="absolute top-6 left-6 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <Icons.Close size={24} />
                </button>

                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative">
                        <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl border border-slate-700">
                             <Icons.Camera size={48} className="text-slate-600" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center border-4 border-brand-dark shadow-lg">
                             <Icons.Close size={20} className="text-white" strokeWidth={3} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Scanner Unavailable</h2>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                            We couldn't access your camera. Please check your browser permissions or try an alternative method.
                        </p>
                    </div>
                    <div className="w-full max-w-sm space-y-3 pt-4">
                        <Button fullWidth onClick={() => fileInputRef.current?.click()} className="bg-brand-surface border border-slate-600 hover:bg-slate-700 text-white">
                             <Icons.QrCode className="mr-2 text-brand-primary" size={20} /> 
                             <span>Upload QR Image</span>
                        </Button>
                        <Button fullWidth onClick={() => setView('send-details')} className="bg-brand-surface border border-slate-600 hover:bg-slate-700 text-white">
                             <Icons.Plus className="mr-2 text-brand-secondary" size={20} /> 
                             <span>Paste Address / Invoice</span>
                        </Button>
                    </div>
                </div>
                {fileInput}
            </div>
        );
    }

    return (
      <div className="relative h-full bg-black flex flex-col">
         <div className="flex-1 relative overflow-hidden">
            <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover z-10" 
                muted autoPlay playsInline
                onLoadedMetadata={() => { videoRef.current?.play().catch(e => console.warn("Auto-play prevented", e)); }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {isCameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center bg-slate-900/90 p-6 rounded-2xl border border-slate-700">
                         <Icons.QrCode className="animate-pulse text-brand-primary mb-3" size={40} />
                         <p className="text-white text-sm font-bold">Starting Camera...</p>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
               <div className="w-64 h-64 border-2 border-brand-primary rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary -mt-1 -ml-1"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary -mt-1 -mr-1"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary -mb-1 -ml-1"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary -mb-1 -mr-1"></div>
                  {!isCameraLoading && (
                      <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                  )}
               </div>
            </div>
            <div className="absolute top-8 left-0 right-0 z-20 text-center pointer-events-none">
               <h2 className="text-white font-bold text-lg drop-shadow-md bg-black/30 inline-block px-4 py-1 rounded-full backdrop-blur-sm">Scan Invoice or Token</h2>
            </div>
            <button onClick={() => setView('main')} className="absolute top-6 left-6 z-30 p-3 bg-black/40 rounded-full text-white hover:bg-black/60 backdrop-blur-md transition-all">
              <Icons.Close size={24} />
            </button>
         </div>
         <div className="bg-brand-dark p-6 pb-24 z-20 border-t border-slate-800 flex space-x-3 bottom-20 fixed left-0 right-0">
            <Button fullWidth variant="secondary" onClick={() => fileInputRef.current?.click()} className="text-white">
               <Icons.QrCode className="mr-2" size={18} /> Upload Image
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setView('send-details')} className="text-white">
               <Icons.Plus className="mr-2" size={18} /> Paste Address
            </Button>
         </div>
         {fileInput}
      </div>
    );
  }

  if (view === 'send-details') {
    return (
      <div className="p-6 h-full flex flex-col relative">
        {isProcessing && <ProcessingOverlay message="Processing..." />}
        
        <div className="flex items-center mb-6">
           <button onClick={() => setView('send-scan')} className="mr-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700">
             <Icons.Prev />
           </button>
           <h2 className="text-xl font-bold">Transaction Details</h2>
        </div>

        {transactionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
                <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="text-red-500 font-bold text-sm">Error</h3>
                    <p className="text-xs text-red-400 mt-1 leading-relaxed">
                        {transactionError}
                    </p>
                </div>
            </div>
        )}

        {insufficientFunds && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
                <Icons.Close className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="text-red-500 font-bold">Insufficient Funds</h3>
                    <p className="text-xs text-red-400 mt-1">
                        Wallet Balance: {walletBalance} Sats<br/>
                        Required: {parseInt(sendAmount || '0') + (quoteFee || 0)} Sats
                    </p>
                </div>
            </div>
        )}

        <div className="space-y-4">
           <div>
              <label className="text-sm text-slate-400 block mb-1">Amount (Sats)</label>
              <div className="relative">
                  <input 
                     type="number" 
                     className={`w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-2xl font-mono focus:ring-2 focus:ring-brand-primary outline-none ${isFixedAmount ? 'opacity-60 cursor-not-allowed' : ''}`}
                     placeholder="0"
                     value={sendAmount}
                     onChange={e => setSendAmount(e.target.value)}
                     readOnly={isFixedAmount}
                  />
                  {isFixedAmount && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                          Fixed
                      </div>
                  )}
              </div>
              {quoteFee !== null && (
                  <p className="text-xs text-slate-500 mt-2 ml-1">
                      + {quoteFee} sats estimated network fee
                  </p>
              )}
           </div>
           
           <div>
              <label className="text-sm text-slate-400 block mb-1">Invoice / Address / Token</label>
              <div className="relative">
                  <textarea 
                     className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm font-mono h-32 focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                     placeholder="lnbc... or user@domain.com or cashuA..."
                     value={sendInput}
                     onChange={e => setSendInput(e.target.value)}
                  />
                  {isCheckingInvoice && (
                      <div className="absolute top-3 right-3">
                          <Icons.Zap size={16} className="text-brand-accent animate-pulse" />
                      </div>
                  )}
              </div>
           </div>

           <div className="pt-4 flex space-x-3">
               <Button fullWidth variant="secondary" onClick={() => setView('main')}>Cancel</Button>
               <Button fullWidth onClick={handleSend} disabled={isProcessing || insufficientFunds || !sendAmount} className={insufficientFunds ? 'opacity-50 cursor-not-allowed' : ''}>
                   {isProcessing ? 'Processing...' : 'Confirm Send'}
               </Button>
           </div>
        </div>
      </div>
    );
  }

  // --- Main View ---

  return (
    <div className="flex flex-col h-full p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold flex items-center">
            <Icons.Wallet className="mr-2 text-brand-primary" /> Wallet
         </h1>
         <button onClick={() => setView('mints')} className="p-2 bg-slate-800 rounded-full hover:text-brand-primary transition-colors">
             <Icons.Settings size={20} />
         </button>
      </div>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden mb-8">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
               <p className="text-slate-400 text-sm font-medium">Available Balance</p>
               <div className="flex items-center space-x-1 bg-black/30 px-2 py-1 rounded-lg">
                   <div className={`w-2 h-2 rounded-full ${activeMint ? 'bg-green-500' : 'bg-red-500'}`}></div>
                   <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">{activeMint ? activeMint.nickname : 'No Mint'}</span>
               </div>
            </div>
            
            <div className="flex items-baseline space-x-1 mb-6">
                <span className="text-5xl font-extrabold tracking-tight text-white">{walletBalance.toLocaleString()}</span>
                <span className="text-xl text-brand-accent font-bold">SATS</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setView('send-scan')} className="flex flex-col items-center justify-center bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-xl py-3 transition-all active:scale-95">
                    <div className="bg-brand-accent/20 p-2 rounded-full mb-1">
                        <Icons.Send size={20} className="text-brand-accent" />
                    </div>
                    <span className="text-sm font-bold">Send</span>
                </button>

                <button onClick={() => setView('deposit')} className="flex flex-col items-center justify-center bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/50 hover:border-brand-primary rounded-xl py-3 transition-all active:scale-95">
                    <div className="bg-brand-primary/20 p-2 rounded-full mb-1">
                        <Icons.Receive size={20} className="text-brand-primary" />
                    </div>
                    <span className="text-sm font-bold text-white">Deposit</span>
                </button>
            </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4 text-slate-300">Recent Activity</h2>
      <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2 no-scrollbar">
        {transactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-50">
                 <Icons.History size={40} className="mb-2" />
                 <p>No transactions yet.</p>
             </div>
        ) : (
            transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                            ['deposit', 'receive'].includes(tx.type) ? 'bg-green-500/20 text-green-400' :
                            ['payout', 'ace_pot'].includes(tx.type) ? 'bg-brand-primary/20 text-brand-primary' :
                            ['send', 'payment'].includes(tx.type) ? 'bg-brand-accent/20 text-brand-accent' :
                            'bg-slate-600/30 text-slate-300'
                        }`}>
                            {['deposit', 'receive'].includes(tx.type) && <Icons.Zap size={16} />}
                            {(tx.type === 'payout' || tx.type === 'ace_pot') && <Icons.Trophy size={16} />}
                            {(tx.type === 'payment' || tx.type === 'send') && <Icons.Send size={16} />}
                        </div>
                        <div>
                            <p className="font-medium text-sm text-white">{tx.description}</p>
                            <p className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <span className={`font-mono font-bold ${['deposit', 'payout', 'ace_pot', 'receive'].includes(tx.type) ? 'text-green-400' : 'text-white'}`}>
                        {['payment', 'send'].includes(tx.type) ? '-' : '+'}{tx.amountSats}
                    </span>
                </div>
            ))
        )}
      </div>
    </div>
  );
};
