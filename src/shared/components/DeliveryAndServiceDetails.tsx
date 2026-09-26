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
  XCircle,
  Truck
} from 'lucide-react';

interface DeliveryAndServiceDetailsProps {
  product: Product;
  settings: StoreSettings;
  isMobile?: boolean;
}

export default function DeliveryAndServiceDetails({ product, settings, isMobile = false }: DeliveryAndServiceDetailsProps) {
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
  const returnPeriodText = product.returnPeriodText || settings.returnPeriodText || `${returnPeriodDays} Days Easy Return & Replacement`;

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
    ? (product.returnPolicy || settings.returnsText || '7-Day Return')
    : (product.noReturnsText || settings.noReturnsText || 'No returns');

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
  const warrantyPeriod = (product as any).warranty || product.warrantyPeriod || settings.warrantyPeriod || '1 Year Brand Warranty';

  // 8. Brand Support
  const isBrandSupportEnabled = product.enableBrandSupport !== undefined
    ? product.enableBrandSupport
    : (settings.enableBrandSupport !== false);
  const brandSupportText = product.brandSupportText || settings.brandSupportText || 'Official Brand Support & Service Available';

  const cards = [];

  // 1. Customer Support Card
  if (isCustomerSupportEnabled) {
    cards.push({
      key: 'customer-support',
      icon: Headphones,
      title: 'Customer Support',
      desc: customerSupportText,
      badge: '24/7 Service',
      containerClass: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950',
      iconClass: 'bg-emerald-100 text-emerald-700',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    });
  }

  // 2. Return Period Card
  if (isReturnPeriodEnabled) {
    cards.push({
      key: 'return-period',
      icon: RotateCcw,
      title: 'Return Period',
      desc: returnPeriodText,
      badge: `${returnPeriodDays} Days`,
      containerClass: 'bg-blue-50/70 border-blue-200/80 text-blue-950',
      iconClass: 'bg-blue-100 text-blue-700',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200'
    });
  }

  // 3. Doorstep Cancellation Card
  cards.push({
    key: 'doorstep-cancellation',
    icon: isDoorstepCancellationEnabled ? CheckCircle2 : Ban,
    title: 'Doorstep Cancellation',
    desc: isDoorstepCancellationEnabled ? 'Doorstep Cancellation Available' : 'No Doorstep Cancellation',
    badge: isDoorstepCancellationEnabled ? 'Allowed' : 'Disabled',
    containerClass: isDoorstepCancellationEnabled ? 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950' : 'bg-rose-50/70 border-rose-200/80 text-rose-950',
    iconClass: isDoorstepCancellationEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700',
    badgeClass: isDoorstepCancellationEnabled ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-rose-100 text-rose-800 border-rose-200'
  });

  // 4. Returns Card
  cards.push({
    key: 'returns',
    icon: isReturnsEnabled ? PackageCheck : XCircle,
    title: 'Returns',
    desc: returnsText,
    badge: isReturnsEnabled ? 'Returnable' : 'Non-Returnable',
    containerClass: isReturnsEnabled ? 'bg-teal-50/70 border-teal-200/80 text-teal-950' : 'bg-amber-50/70 border-amber-200/80 text-amber-950',
    iconClass: isReturnsEnabled ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700',
    badgeClass: isReturnsEnabled ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-amber-100 text-amber-800 border-amber-200'
  });

  // 5. COD Card
  cards.push({
    key: 'cod',
    icon: Banknote,
    title: 'Cash on Delivery',
    desc: codText,
    badge: isCodEnabled ? 'COD Active' : 'No COD',
    containerClass: isCodEnabled ? 'bg-cyan-50/70 border-cyan-200/80 text-cyan-950' : 'bg-slate-50/70 border-slate-200/80 text-slate-900',
    iconClass: isCodEnabled ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-600',
    badgeClass: isCodEnabled ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 'bg-slate-200 text-slate-700 border-slate-300'
  });

  // 6. Free Delivery Card (Hide when disabled)
  if (isFreeDeliveryEnabled) {
    cards.push({
      key: 'free-delivery',
      icon: Sparkles,
      title: 'Free Delivery',
      desc: 'Free Delivery Available',
      badge: 'Free',
      containerClass: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950',
      iconClass: 'bg-emerald-100 text-emerald-700',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    });
  }

  // 7. Warranty Card
  if (isWarrantyEnabled) {
    cards.push({
      key: 'warranty',
      icon: ShieldCheck,
      title: 'Warranty',
      desc: warrantyPeriod,
      badge: 'Covered',
      containerClass: 'bg-purple-50/70 border-purple-200/80 text-purple-950',
      iconClass: 'bg-purple-100 text-purple-700',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200'
    });
  }

  // 8. Brand Support Card
  if (isBrandSupportEnabled) {
    cards.push({
      key: 'brand-support',
      icon: Shield,
      title: 'Brand Support',
      desc: brandSupportText,
      badge: 'Official',
      containerClass: 'bg-sky-50/70 border-sky-200/80 text-sky-950',
      iconClass: 'bg-sky-100 text-sky-700',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200'
    });
  }

  return (
    <div className="space-y-3.5 pt-6 border-t border-gray-100 w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">
            Delivery & Service Details
          </h3>
        </div>
        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 uppercase tracking-widest">
          ViBa Verified
        </span>
      </div>

      <div
        className={
          isMobile
            ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full"
        }
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`p-3 rounded-2xl border transition-all flex items-start gap-3 w-full overflow-hidden ${card.containerClass}`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${card.iconClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                  <span className="text-xs font-extrabold truncate text-gray-900">
                    {card.title}
                  </span>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${card.badgeClass}`}
                  >
                    {card.badge}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-gray-600 leading-snug line-clamp-2 break-words">
                  {card.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
