import React from 'react';
import { Product, StoreSettings } from '../types';
import {
  Headphones,
  RotateCcw,
  PackageCheck,
  Banknote,
  ShieldCheck,
  Shield,
  Sparkles,
  Ban,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface DeliveryAndServiceDetailsProps {
  product: Product;
  settings: StoreSettings;
}

export default function DeliveryAndServiceDetails({ product, settings }: DeliveryAndServiceDetailsProps) {
  if (!product || !settings) return null;

  // 1. Customer Support
  const isCustomerSupportEnabled = product.enableCustomerSupport !== undefined
    ? product.enableCustomerSupport
    : (settings.enableCustomerSupport !== false);
  const customerSupportText = product.customerSupportText || settings.customerSupportText || '24/7 Customer Support';

  // 2. Return Period
  const isReturnPeriodEnabled = product.enableReturnPeriod !== undefined
    ? product.enableReturnPeriod
    : (settings.enableReturnPeriod !== false);
  const returnPeriodDays = (product as any).returnDays || product.returnPeriodDays || settings.returnPeriodDays || settings.returnWindowDays || 7;
  const returnPeriodText = product.returnPeriodText || settings.returnPeriodText || `${returnPeriodDays}-Day Return`;

  // 3. Doorstep Cancellation
  const isDoorstepCancellationEnabled = product.enableDoorstepCancellation !== undefined
    ? product.enableDoorstepCancellation
    : (settings.enableDoorstepCancellation !== false);

  // 4. Returns
  const isReturnsEnabled = product.isReturnable !== undefined
    ? product.isReturnable
    : product.enableReturns !== undefined
      ? product.enableReturns
      : (settings.enableReturns !== false);
  const returnsText = isReturnsEnabled
    ? (product.returnPolicy || settings.returnsText || `${returnPeriodDays}-Day Return`)
    : (product.noReturnsText || settings.noReturnsText || 'Non-Returnable');

  // 5. COD
  const isCodEnabled = product.isCodAllowed !== undefined
    ? product.isCodAllowed
    : (settings.enableCod !== false);
  const codText = isCodEnabled ? 'Cash on Delivery' : 'No Cash on Delivery';

  // 6. Free Delivery (when disabled, hide it completely)
  const isFreeDeliveryEnabled = product.isFreeDelivery !== undefined
    ? product.isFreeDelivery
    : (settings.enableFreeDelivery !== false);

  // 7. Warranty
  const isWarrantyEnabled = product.enableWarranty !== undefined
    ? product.enableWarranty
    : (settings.enableWarranty !== false);
  const warrantyPeriod = (product as any).warranty || product.warrantyPeriod || settings.warrantyPeriod || '1 Year Warranty';

  // 8. Brand Support
  const isBrandSupportEnabled = product.enableBrandSupport !== undefined
    ? product.enableBrandSupport
    : (settings.enableBrandSupport !== false);
  const brandSupportText = product.brandSupportText || settings.brandSupportText || 'Brand Support';

  const cards = [];

  if (isCustomerSupportEnabled) {
    cards.push({
      key: 'support',
      icon: Headphones,
      text: customerSupportText,
      iconClass: 'text-emerald-700 bg-emerald-100/90',
      borderClass: 'border-emerald-200/80 bg-emerald-50/50'
    });
  }

  if (isReturnPeriodEnabled) {
    cards.push({
      key: 'return-period',
      icon: RotateCcw,
      text: returnPeriodText,
      iconClass: 'text-blue-700 bg-blue-100/90',
      borderClass: 'border-blue-200/80 bg-blue-50/50'
    });
  }

  if (isDoorstepCancellationEnabled !== undefined) {
    cards.push({
      key: 'doorstep-cancel',
      icon: isDoorstepCancellationEnabled ? CheckCircle2 : Ban,
      text: isDoorstepCancellationEnabled ? 'Doorstep Cancellation' : 'No Doorstep Cancel',
      iconClass: isDoorstepCancellationEnabled ? 'text-indigo-700 bg-indigo-100/90' : 'text-rose-700 bg-rose-100/90',
      borderClass: isDoorstepCancellationEnabled ? 'border-indigo-200/80 bg-indigo-50/50' : 'border-rose-200/80 bg-rose-50/50'
    });
  }

  if (isReturnsEnabled !== undefined) {
    cards.push({
      key: 'returns',
      icon: isReturnsEnabled ? PackageCheck : XCircle,
      text: returnsText,
      iconClass: isReturnsEnabled ? 'text-teal-700 bg-teal-100/90' : 'text-amber-700 bg-amber-100/90',
      borderClass: isReturnsEnabled ? 'border-teal-200/80 bg-teal-50/50' : 'border-amber-200/80 bg-amber-50/50'
    });
  }

  cards.push({
    key: 'cod',
    icon: Banknote,
    text: codText,
    iconClass: isCodEnabled ? 'text-cyan-700 bg-cyan-100/90' : 'text-slate-600 bg-slate-200/90',
    borderClass: isCodEnabled ? 'border-cyan-200/80 bg-cyan-50/50' : 'border-slate-200/80 bg-slate-50/50'
  });

  if (isFreeDeliveryEnabled) {
    cards.push({
      key: 'free-delivery',
      icon: Sparkles,
      text: 'Free Delivery',
      iconClass: 'text-emerald-700 bg-emerald-100/90',
      borderClass: 'border-emerald-200/80 bg-emerald-50/50'
    });
  }

  if (isWarrantyEnabled) {
    cards.push({
      key: 'warranty',
      icon: ShieldCheck,
      text: warrantyPeriod,
      iconClass: 'text-purple-700 bg-purple-100/90',
      borderClass: 'border-purple-200/80 bg-purple-50/50'
    });
  }

  if (isBrandSupportEnabled) {
    cards.push({
      key: 'brand-support',
      icon: Shield,
      text: brandSupportText,
      iconClass: 'text-sky-700 bg-sky-100/90',
      borderClass: 'border-sky-200/80 bg-sky-50/50'
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="w-full mt-2.5 pt-2 border-t border-gray-100">
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory flex-nowrap w-full touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`flex-shrink-0 flex-grow-0 w-[calc(33.333%-5.5px)] sm:w-[125px] md:w-[135px] lg:w-[145px] min-w-[98px] h-[44px] px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-2 snap-start overflow-hidden ${card.borderClass}`}
            >
              <div className={`p-1 rounded-md shrink-0 ${card.iconClass}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-black text-gray-900 truncate leading-none">
                {card.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
