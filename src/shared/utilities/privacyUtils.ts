import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';

export interface PrivacySubCategory {
  title: string;
  bulletPoints: string[];
}

export interface PrivacySection {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
  bulletPoints?: string[];
  subCategories?: PrivacySubCategory[];
}

export interface PrivacyConfig {
  title: string;
  lastUpdated: string;
  introParagraphs: string[];
  sections: PrivacySection[];
  footerNote?: string;
  updatedAt?: string;
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  title: 'Privacy Policy',
  lastUpdated: 'September 28, 2026',
  introParagraphs: [
    'Welcome to ViBa Mart. Your privacy is important to us. This Privacy Policy explains how ViBa Mart (“ViBa Mart”, “we”, “us”, or “our”) collects, uses, stores, shares, and protects information when you use our website, mobile experience, applications, products, services, and related features (collectively, the “Services”).',
    'By using ViBa Mart, you acknowledge that you have read and understood this Privacy Policy.'
  ],
  sections: [
    {
      id: 'section-1',
      number: 1,
      title: 'Information We Collect',
      paragraphs: [
        'Depending on how you use ViBa Mart, we may collect information such as:'
      ],
      subCategories: [
        {
          title: 'Account Information',
          bulletPoints: [
            'Name',
            'Mobile number',
            'Email address',
            'Login and authentication information',
            'Account-related information'
          ]
        },
        {
          title: 'Delivery Information',
          bulletPoints: [
            'Name of recipient',
            'Phone number',
            'Delivery address',
            'Area/street',
            'City',
            'State',
            'Country',
            'PIN code',
            'Location information when you choose to use location-based features'
          ]
        },
        {
          title: 'Order Information',
          bulletPoints: [
            'Products purchased',
            'Order ID',
            'Order date',
            'Order status',
            'Order amount',
            'Delivery information',
            'Cancellation, return, and refund information',
            'Customer requests and support information'
          ]
        },
        {
          title: 'Payment Information',
          bulletPoints: [
            'Payments may be processed through third-party payment providers.',
            'ViBa Mart may receive information such as payment status, transaction reference, payment method, and verification information required to process an order.',
            'We do not intend to store complete card numbers, CVV numbers, UPI PINs, or other sensitive payment credentials that payment providers are responsible for processing.'
          ]
        },
        {
          title: 'Device and Technical Information',
          bulletPoints: [
            'Device type',
            'Browser type',
            'Operating system',
            'IP address',
            'Approximate location information',
            'Device identifiers',
            'Website/app activity',
            'Error and diagnostic information'
          ]
        },
        {
          title: 'Communications',
          bulletPoints: [
            'If you contact ViBa Mart, we may retain information from your communication, including customer-support requests, order-related messages, and information you provide to resolve an issue.'
          ]
        }
      ]
    },
    {
      id: 'section-2',
      number: 2,
      title: 'How We Use Information',
      paragraphs: [
        'We may use collected information to:'
      ],
      bulletPoints: [
        'Create and manage your account.',
        'Authenticate your identity.',
        'Process and fulfill orders.',
        'Deliver products.',
        'Process payments.',
        'Process cancellations, returns, and refunds.',
        'Provide customer support.',
        'Verify orders and transactions.',
        'Send order confirmations and updates.',
        'Send delivery and shipment notifications.',
        'Send important account or service notifications.',
        'Provide coupons, rewards, offers, and promotions where applicable.',
        'Improve products and Services.',
        'Detect fraud, abuse, and unauthorized activity.',
        'Maintain website and application security.',
        'Troubleshoot technical problems.',
        'Comply with applicable legal requirements.'
      ]
    },
    {
      id: 'section-3',
      number: 3,
      title: 'Location Information',
      paragraphs: [
        'ViBa Mart may request access to your device location when you use location-based features, such as selecting or detecting a delivery address.',
        'Location access is used to help identify or select a relevant delivery location.',
        'You can control location permissions through your device or browser settings.',
        'ViBa Mart should not use precise location information for purposes unrelated to the feature for which you provided access unless otherwise permitted by applicable law or with appropriate notice/consent.'
      ]
    },
    {
      id: 'section-4',
      number: 4,
      title: 'Cookies and Similar Technologies',
      paragraphs: [
        'ViBa Mart may use cookies and similar technologies to:'
      ],
      bulletPoints: [
        'Keep you signed in.',
        'Remember preferences.',
        'Maintain shopping-cart functionality.',
        'Improve website performance.',
        'Understand how Services are used.',
        'Maintain security.',
        'Provide relevant functionality.'
      ]
    },
    {
      id: 'section-5',
      number: 5,
      title: 'Shopping Cart and Wishlist Information',
      paragraphs: [
        'ViBa Mart may store information related to:'
      ],
      bulletPoints: [
        'Shopping-cart products',
        'Product quantities',
        'Wishlist products',
        'Recently viewed products',
        'Product preferences'
      ]
    },
    {
      id: 'section-6',
      number: 6,
      title: 'Notifications',
      paragraphs: [
        'Where supported and where you provide permission, ViBa Mart may send notifications relating to:'
      ],
      bulletPoints: [
        'Orders',
        'Payments',
        'Delivery',
        'Offers',
        'Coupons',
        'Rewards',
        'Product availability',
        'Price changes',
        'Customer-support updates',
        'Other important Service information'
      ]
    },
    {
      id: 'section-7',
      number: 7,
      title: 'How We Share Information',
      paragraphs: [
        'ViBa Mart may share necessary information with trusted service providers that help us operate the Services, including:'
      ],
      bulletPoints: [
        'Payment providers',
        'Delivery and logistics providers',
        'Authentication providers',
        'Cloud and hosting providers',
        'Mapping and location providers',
        'Notification providers',
        'Customer-support providers',
        'Security and fraud-prevention providers'
      ]
    },
    {
      id: 'section-8',
      number: 8,
      title: 'Third-Party Services',
      paragraphs: [
        'ViBa Mart may use third-party services for payments, authentication, maps, notifications, analytics, hosting, delivery, and other functionality.',
        'These third parties may process information according to their own privacy policies and applicable terms.',
        'We recommend reviewing the privacy policies of relevant third-party services when using their features.'
      ]
    },
    {
      id: 'section-9',
      number: 9,
      title: 'Data Security',
      paragraphs: [
        'ViBa Mart uses reasonable technical and organizational measures designed to protect information from unauthorized access, alteration, disclosure, or destruction.',
        'However, no internet-based system can be guaranteed to be completely secure.',
        'You are responsible for protecting your account credentials, OTPs, and devices.'
      ]
    },
    {
      id: 'section-10',
      number: 10,
      title: 'Data Retention',
      paragraphs: [
        'We retain information for as long as reasonably necessary for purposes such as:'
      ],
      bulletPoints: [
        'Providing Services',
        'Maintaining account and order records',
        'Processing payments',
        'Handling returns and refunds',
        'Customer support',
        'Security and fraud prevention',
        'Legal and regulatory requirements',
        'Resolving disputes'
      ]
    },
    {
      id: 'section-11',
      number: 11,
      title: 'Your Choices and Rights',
      paragraphs: [
        'Depending on applicable law, you may have rights relating to your personal information, including the ability to:'
      ],
      bulletPoints: [
        'Request access to certain personal information.',
        'Request correction of inaccurate information.',
        'Request deletion where legally applicable.',
        'Withdraw certain permissions or consent.',
        'Manage certain communication preferences.',
        'Raise concerns regarding the processing of your information.'
      ]
    },
    {
      id: 'section-12',
      number: 12,
      title: "Children's Privacy",
      paragraphs: [
        'ViBa Mart\'s Services are not intentionally designed to collect personal information from children without appropriate authorization where such authorization is required by applicable law.',
        'If you believe that a child has provided personal information to ViBa Mart improperly, please contact us so that we can review the situation and take appropriate action.'
      ]
    },
    {
      id: 'section-13',
      number: 13,
      title: 'Fraud and Security',
      paragraphs: [
        'We may process information to detect, investigate, and prevent:'
      ],
      bulletPoints: [
        'Fraudulent transactions',
        'Account abuse',
        'Coupon or reward abuse',
        'Unauthorized account access',
        'Payment-related fraud',
        'Other activities that may harm customers or ViBa Mart'
      ]
    },
    {
      id: 'section-14',
      number: 14,
      title: 'Changes to Your Information',
      paragraphs: [
        'You should keep your account and delivery information accurate and up to date.',
        'You may update available account and address information through your ViBa Mart account where those features are provided.'
      ]
    },
    {
      id: 'section-15',
      number: 15,
      title: 'Changes to This Privacy Policy',
      paragraphs: [
        'ViBa Mart may update this Privacy Policy from time to time.',
        'When changes are made, the updated Privacy Policy will be published on this page and the Last Updated date will be revised.',
        'Your continued use of the Services after an update means that you acknowledge the updated Privacy Policy, subject to applicable law.'
      ]
    },
    {
      id: 'section-16',
      number: 16,
      title: 'Governing Law',
      paragraphs: [
        'This Privacy Policy is intended to be governed by the applicable laws of India.',
        'Any privacy-related dispute will be handled according to applicable Indian law and the applicable dispute-resolution requirements.'
      ]
    },
    {
      id: 'section-17',
      number: 17,
      title: 'Contact Us',
      paragraphs: [
        'If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your personal information, please contact ViBa Mart Customer Support / Order Help through the official contact options available on the website or application.'
      ]
    },
    {
      id: 'section-18',
      number: 18,
      title: 'Acknowledgement',
      paragraphs: [
        'By using ViBa Mart, you acknowledge that you have read and understood this Privacy Policy.'
      ]
    }
  ],
  footerNote: 'ViBa Mart\nPrivacy Policy\nLast Updated: September 28, 2026'
};

export async function fetchPrivacyConfig(): Promise<PrivacyConfig> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'privacy'));
    if (snap.exists()) {
      return snap.data() as PrivacyConfig;
    }
  } catch (err) {
    console.error('Error fetching privacy config:', err);
  }
  return DEFAULT_PRIVACY_CONFIG;
}

export async function savePrivacyConfig(config: PrivacyConfig): Promise<void> {
  const payload = {
    ...config,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'settings', 'privacy'), payload, { merge: true });
}
