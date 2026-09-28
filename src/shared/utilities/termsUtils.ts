import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';

export interface TermsSection {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
  bulletPoints?: string[];
}

export interface TermsConfig {
  title: string;
  lastUpdated: string;
  introParagraphs: string[];
  highlightNotice?: string;
  sections: TermsSection[];
  footerNote?: string;
  updatedAt?: string;
}

export const DEFAULT_TERMS_CONFIG: TermsConfig = {
  title: 'Terms of Service',
  lastUpdated: 'September 28, 2026',
  introParagraphs: [
    'Welcome to ViBa Mart. These Terms of Service (“Terms”) govern your access to and use of the ViBa Mart website, mobile experience, applications, products, services, and related features (collectively, the “Services”).'
  ],
  highlightNotice: 'By accessing or using ViBa Mart, creating an account, placing an order, purchasing a product, or using any of our Services, you agree to these Terms. If you do not agree with these Terms, please do not use the Services.',
  sections: [
    {
      id: 'section-1',
      number: 1,
      title: 'About ViBa Mart',
      paragraphs: [
        'ViBa Mart is an online marketplace and e-commerce platform through which customers can browse products, place orders, make payments, receive deliveries, and use related services such as offers, coupons, rewards, returns, cancellations, refunds, and customer support.',
        'ViBa Mart may update, add, remove, or modify products and Services from time to time.'
      ]
    },
    {
      id: 'section-2',
      number: 2,
      title: 'Eligibility and Account',
      paragraphs: [
        'You are responsible for providing accurate information when creating or using your ViBa Mart account.',
        'You agree to:'
      ],
      bulletPoints: [
        'Provide accurate and current information.',
        'Keep your account information updated.',
        'Protect your login credentials and OTPs.',
        'Not share your account or authentication credentials with unauthorized persons.',
        'Immediately notify ViBa Mart if you believe your account has been accessed without authorization.'
      ]
    },
    {
      id: 'section-3',
      number: 3,
      title: 'Products and Product Information',
      paragraphs: [
        'We make reasonable efforts to display product information accurately, including:'
      ],
      bulletPoints: [
        'Product name',
        'Images',
        'Description',
        'Price',
        'Discount',
        'Available variants',
        'Size and color',
        'Availability',
        'Warranty information where applicable',
        'Delivery information'
      ]
    },
    {
      id: 'section-4',
      number: 4,
      title: 'Product Pricing and Discounts',
      paragraphs: [
        'The price payable for an order is the price displayed at checkout before the order is confirmed.',
        'Prices may include applicable taxes or charges as displayed during checkout.',
        'ViBa Mart may provide discounts, promotional prices, coupons, rewards, or other offers subject to their individual terms.',
        'If a pricing or promotional error is discovered before an order is fulfilled, ViBa Mart may contact the customer and provide the applicable options under the circumstances.'
      ]
    },
    {
      id: 'section-5',
      number: 5,
      title: 'Orders',
      paragraphs: [
        'When you place an order, you are requesting ViBa Mart to process and fulfill your purchase.',
        'An order confirmation does not necessarily guarantee fulfillment if circumstances such as stock availability, payment verification, technical errors, suspected fraud, or other legitimate operational issues prevent fulfillment.',
        'ViBa Mart may cancel or restrict an order where necessary and will provide applicable refund treatment according to the payment method and relevant policy.'
      ]
    },
    {
      id: 'section-6',
      number: 6,
      title: 'Payments',
      paragraphs: [
        'ViBa Mart may support payment methods such as:'
      ],
      bulletPoints: [
        'Online payments',
        'UPI',
        'Cards',
        'Other supported digital payment methods',
        'Cash on Delivery, where enabled for the applicable product or order'
      ]
    },
    {
      id: 'section-7',
      number: 7,
      title: 'Delivery',
      paragraphs: [
        'Delivery estimates are provided based on the delivery address, product availability, logistics conditions, and other factors.',
        'Delivery times may change because of:'
      ],
      bulletPoints: [
        'Weather',
        'Transportation delays',
        'Operational issues',
        'Incorrect or incomplete address information',
        'Public holidays',
        'Events outside ViBa Mart\'s reasonable control'
      ]
    },
    {
      id: 'section-8',
      number: 8,
      title: 'Delivery Address',
      paragraphs: [
        'Customers may select or save delivery addresses through their ViBa Mart account.',
        'Customers are responsible for ensuring that:'
      ],
      bulletPoints: [
        'The name and contact number are correct.',
        'The address is complete.',
        'The PIN code is accurate.',
        'Someone is available to receive the order where required.'
      ]
    },
    {
      id: 'section-9',
      number: 9,
      title: 'Cancellation',
      paragraphs: [
        'Cancellation availability depends on the order\'s current status.',
        'Customers may request cancellation through the available order-management options when cancellation is permitted.',
        'Once an order has progressed beyond the eligible cancellation stage, cancellation may no longer be available.',
        'Any applicable refund will be processed according to the payment method and ViBa Mart\'s applicable refund process.'
      ]
    },
    {
      id: 'section-10',
      number: 10,
      title: 'Returns',
      paragraphs: [
        'Returns are available only for eligible products and circumstances specified on the applicable product or order page.',
        'Where applicable, a return may be accepted for reasons such as:'
      ],
      bulletPoints: [
        'Wrong product received',
        'Defective product',
        'Damaged product',
        'Other eligible reasons specified by ViBa Mart'
      ]
    },
    {
      id: 'section-11',
      number: 11,
      title: 'Refunds',
      paragraphs: [
        'If a refund is approved, the refund amount and processing method may depend on:'
      ],
      bulletPoints: [
        'Payment method',
        'Order status',
        'Product condition',
        'Return/cancellation eligibility',
        'Applicable fees or deductions',
        'Verification results'
      ]
    },
    {
      id: 'section-12',
      number: 12,
      title: 'Warranty and Brand Support',
      paragraphs: [
        'Some products may include manufacturer, seller, or brand warranty/support.',
        'Where warranty information is provided, the applicable warranty period and terms are those displayed for the relevant product.',
        'Warranty claims may be subject to the manufacturer\'s or brand\'s conditions.',
        'ViBa Mart does not automatically provide a warranty for every product.'
      ]
    },
    {
      id: 'section-13',
      number: 13,
      title: 'Coupons, Rewards and Offers',
      paragraphs: [
        'ViBa Mart may provide coupons, promotional offers, rewards, discounts, and other benefits.',
        'Such offers may have:'
      ],
      bulletPoints: [
        'Expiry dates',
        'Product restrictions',
        'Brand restrictions',
        'Minimum purchase requirements',
        'Usage limits',
        'Payment requirements',
        'Other eligibility conditions'
      ]
    },
    {
      id: 'section-14',
      number: 14,
      title: 'Reviews and User Content',
      paragraphs: [
        'Where ViBa Mart allows customers to submit reviews, ratings, photographs, videos, or other content, you agree that the content:'
      ],
      bulletPoints: [
        'Must be truthful and relevant.',
        'Must not contain unlawful, abusive, threatening, or misleading material.',
        'Must not violate another person\'s rights.',
        'Must not contain malicious code or harmful material.'
      ]
    },
    {
      id: 'section-15',
      number: 15,
      title: 'Prohibited Activities',
      paragraphs: [
        'You must not use ViBa Mart to:'
      ],
      bulletPoints: [
        'Commit fraud or deceive other users.',
        'Create accounts using false information.',
        'Abuse coupons, rewards, refunds, or promotional offers.',
        'Attempt unauthorized access to systems or accounts.',
        'Interfere with the operation or security of the Services.',
        'Upload malicious code or harmful content.',
        'Scrape or automatically collect data without authorization.',
        'Use the Services for unlawful purposes.',
        'Circumvent security or access controls.'
      ]
    },
    {
      id: 'section-16',
      number: 16,
      title: 'Intellectual Property',
      paragraphs: [
        'The ViBa Mart name, logo, branding, website design, software, graphics, text, interfaces, and other original content are protected by applicable intellectual-property laws.',
        'You may not reproduce, modify, distribute, sell, or commercially exploit ViBa Mart\'s proprietary materials without appropriate authorization.',
        'Product names, trademarks, logos, and other materials belonging to third parties remain the property of their respective owners.'
      ]
    },
    {
      id: 'section-17',
      number: 17,
      title: 'Third-Party Services',
      paragraphs: [
        'ViBa Mart may integrate with third-party services such as:'
      ],
      bulletPoints: [
        'Payment providers',
        'Delivery/logistics providers',
        'Authentication providers',
        'Mapping/location services',
        'Communication or notification services'
      ]
    },
    {
      id: 'section-18',
      number: 18,
      title: 'Service Availability',
      paragraphs: [
        'We aim to keep ViBa Mart available and functioning reliably, but uninterrupted availability cannot be guaranteed.',
        'The Services may occasionally be unavailable because of:'
      ],
      bulletPoints: [
        'Maintenance',
        'Updates',
        'Technical problems',
        'Security incidents',
        'Infrastructure failures',
        'Events outside our reasonable control'
      ]
    },
    {
      id: 'section-19',
      number: 19,
      title: 'Limitation of Liability',
      paragraphs: [
        'To the extent permitted by applicable law, ViBa Mart will not be responsible for indirect or consequential losses arising from circumstances outside its reasonable control.',
        'Nothing in these Terms is intended to exclude or limit rights or remedies that cannot legally be excluded or limited under applicable law.'
      ]
    },
    {
      id: 'section-20',
      number: 20,
      title: 'Changes to These Terms',
      paragraphs: [
        'ViBa Mart may update these Terms when necessary.',
        'The updated version will be published on the ViBa Mart website with a revised Last Updated date.',
        'Your continued use of the Services after an update means that you agree to the updated Terms, to the extent permitted by applicable law.'
      ]
    },
    {
      id: 'section-21',
      number: 21,
      title: 'Governing Law',
      paragraphs: [
        'These Terms are intended to be governed by the applicable laws of India.',
        'Any dispute will be handled according to the applicable jurisdiction and dispute-resolution requirements under Indian law.'
      ]
    },
    {
      id: 'section-22',
      number: 22,
      title: 'Contact and Customer Support',
      paragraphs: [
        'For questions regarding orders, payments, delivery, cancellations, returns, refunds, or these Terms, customers should use the official ViBa Mart Customer Support / Order Help options available through the website or application.'
      ]
    },
    {
      id: 'section-23',
      number: 23,
      title: 'Acceptance of Terms',
      paragraphs: [
        'By using ViBa Mart, you acknowledge that you have read, understood, and agreed to these Terms of Service.'
      ]
    }
  ],
  footerNote: 'ViBa Mart\nTerms of Service\nLast Updated: September 28, 2026'
};

export async function fetchTermsConfig(): Promise<TermsConfig> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'terms'));
    if (snap.exists()) {
      return snap.data() as TermsConfig;
    }
  } catch (err) {
    console.error('Error fetching terms config:', err);
  }
  return DEFAULT_TERMS_CONFIG;
}

export async function saveTermsConfig(config: TermsConfig): Promise<void> {
  const payload = {
    ...config,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'settings', 'terms'), payload, { merge: true });
}
