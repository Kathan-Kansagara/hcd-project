import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Copy,
  Download,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { paymentService } from '@/services/payment.service';

interface UpiQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
  invoiceNumber?: string;
  amountDue?: number;
}

interface UpiQrData {
  upi_uri: string;
  upi_id: string;
  payee_name: string;
  amount: number;
  currency: string;
  invoice_number: string;
  customer_name: string;
}

export function UpiQrDialog({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  amountDue,
}: UpiQrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<UpiQrData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchQrData();
    }
    if (!isOpen) {
      setQrData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, invoiceId]);

  useEffect(() => {
    if (qrData?.upi_uri && canvasRef.current) {
      generateQr(qrData.upi_uri);
    }
  }, [qrData]);

  const fetchQrData = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await paymentService.getUpiQrData(invoiceId);
      setQrData(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || 'Failed to generate UPI QR code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateQr = async (uri: string) => {
    if (!canvasRef.current) return;
    try {
      await QRCode.toCanvas(canvasRef.current, uri, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch {
      setError('Failed to render QR code');
    }
  };

  const handleCopyUpiId = async () => {
    if (!qrData?.upi_id) return;
    try {
      await navigator.clipboard.writeText(qrData.upi_id);
      setCopied(true);
      toast({ title: 'Copied', description: 'UPI ID copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `UPI-QR-${qrData?.invoice_number || 'payment'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    toast({ title: 'Downloaded', description: 'QR code saved as PNG' });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Smartphone className="h-5 w-5 text-orange-600" />
            </div>
            UPI Payment
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with any UPI app to pay
            {invoiceNumber ? ` for ${invoiceNumber}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="p-4 rounded-full bg-orange-50">
                <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Generating QR code...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="p-4 rounded-full bg-red-50 ring-4 ring-red-100">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-semibold text-red-700">QR Generation Failed</h3>
                <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQrData}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* QR Code Display */}
          {qrData && !loading && !error && (
            <>
              {/* Amount card */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-orange-700">
                    {qrData.invoice_number}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                    {qrData.customer_name}
                  </span>
                </div>
                <Separator className="bg-orange-100" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount to Pay</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(qrData.amount)}
                  </span>
                </div>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center space-y-3 py-2">
                <div className="bg-white p-3 rounded-2xl shadow-md border-2 border-orange-100 relative">
                  <canvas ref={canvasRef} />
                  {/* UPI logo overlay */}
                  <div className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-orange-600 border border-orange-200">
                    UPI
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                  Scan with Google Pay, PhonePe, Paytm, or any UPI app
                </p>
              </div>

              {/* UPI ID section */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Pay to UPI ID</p>
                    <p className="text-sm font-mono font-semibold">{qrData.upi_id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyUpiId}
                    className="h-8 px-2"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Payee: {qrData.payee_name}</span>
                  <span>Amount: {formatCurrency(qrData.amount)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  size="sm"
                  onClick={handleDownloadQr}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Save QR
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  size="sm"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                After payment, record the transaction using "Record Payment" with UPI reference ID
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
