import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, FileText, Scale, Clock, CheckCircle2 } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-8 md:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50 mb-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Legal & Policy Documentation
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Last Updated: September 28, 2026</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
            Terms of Service
          </h1>

          <div className="prose prose-emerald max-w-none text-gray-600 text-sm sm:text-base leading-relaxed space-y-4">
            <p>
              Welcome to ViBa Mart. These Terms of Service (“Terms”) govern your access to and use of the ViBa Mart website, mobile experience, applications, products, services, and related features (collectively, the “Services”).
            </p>
            <p className="font-medium text-gray-800 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100/80">
              By accessing or using ViBa Mart, creating an account, placing an order, purchasing a product, or using any of our Services, you agree to these Terms. If you do not agree with these Terms, please do not use the Services.
            </p>
          </div>
        </motion.div>

        {/* Content Body */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50 space-y-10"
        >
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">1.</span> About ViBa Mart
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart is an online marketplace and e-commerce platform through which customers can browse products, place orders, make payments, receive deliveries, and use related services such as offers, coupons, rewards, returns, cancellations, refunds, and customer support.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may update, add, remove, or modify products and Services from time to time.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">2.</span> Eligibility and Account
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              You are responsible for providing accurate information when creating or using your ViBa Mart account.
            </p>
            <p className="text-gray-700 font-bold text-sm sm:text-base">You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600 text-sm sm:text-base">
              <li>Provide accurate and current information.</li>
              <li>Keep your account information updated.</li>
              <li>Protect your login credentials and OTPs.</li>
              <li>Not share your account or authentication credentials with unauthorized persons.</li>
              <li>Immediately notify ViBa Mart if you believe your account has been accessed without authorization.</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              ViBa Mart may restrict or suspend an account where there is reasonable evidence of misuse, fraud, unauthorized activity, or violation of these Terms.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">3.</span> Products and Product Information
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              We make reasonable efforts to display product information accurately, including:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Product name</li>
              <li>Images</li>
              <li>Description</li>
              <li>Price</li>
              <li>Discount</li>
              <li>Available variants</li>
              <li>Size and color</li>
              <li>Availability</li>
              <li>Warranty information where applicable</li>
              <li>Delivery information</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Product images may vary slightly from the physical product because of screen settings, lighting, photography, or manufacturer packaging.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Availability and prices may change without prior notice.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">4.</span> Product Pricing and Discounts
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The price payable for an order is the price displayed at checkout before the order is confirmed.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Prices may include applicable taxes or charges as displayed during checkout.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may provide discounts, promotional prices, coupons, rewards, or other offers subject to their individual terms.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              If a pricing or promotional error is discovered before an order is fulfilled, ViBa Mart may contact the customer and provide the applicable options under the circumstances.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">5.</span> Orders
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              When you place an order, you are requesting ViBa Mart to process and fulfill your purchase.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              An order confirmation does not necessarily guarantee fulfillment if circumstances such as stock availability, payment verification, technical errors, suspected fraud, or other legitimate operational issues prevent fulfillment.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may cancel or restrict an order where necessary and will provide applicable refund treatment according to the payment method and relevant policy.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">6.</span> Payments
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may support payment methods such as:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Online payments</li>
              <li>UPI</li>
              <li>Cards</li>
              <li>Other supported digital payment methods</li>
              <li>Cash on Delivery, where enabled for the applicable product or order</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Payment availability may vary by product, location, order value, and other applicable conditions.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              For Cash on Delivery orders, any applicable COD fee will be displayed during checkout.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Where COD is disabled for a particular product, Cash on Delivery will not be available for that product.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">7.</span> Delivery
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Delivery estimates are provided based on the delivery address, product availability, logistics conditions, and other factors.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Delivery times may change because of:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Weather</li>
              <li>Transportation delays</li>
              <li>Operational issues</li>
              <li>Incorrect or incomplete address information</li>
              <li>Public holidays</li>
              <li>Events outside ViBa Mart's reasonable control</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Customers are responsible for providing an accurate delivery address and contact information.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Applicable delivery charges will be displayed during checkout.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">8.</span> Delivery Address
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Customers may select or save delivery addresses through their ViBa Mart account.
            </p>
            <p className="text-gray-700 font-bold text-sm sm:text-base">Customers are responsible for ensuring that:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>The name and contact number are correct.</li>
              <li>The address is complete.</li>
              <li>The PIN code is accurate.</li>
              <li>Someone is available to receive the order where required.</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              ViBa Mart may be unable to deliver an order if the provided address is inaccurate, incomplete, inaccessible, or outside the applicable delivery area.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">9.</span> Cancellation
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Cancellation availability depends on the order's current status.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Customers may request cancellation through the available order-management options when cancellation is permitted.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Once an order has progressed beyond the eligible cancellation stage, cancellation may no longer be available.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Any applicable refund will be processed according to the payment method and ViBa Mart's applicable refund process.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">10.</span> Returns
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Returns are available only for eligible products and circumstances specified on the applicable product or order page.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Where applicable, a return may be accepted for reasons such as:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Wrong product received</li>
              <li>Defective product</li>
              <li>Damaged product</li>
              <li>Other eligible reasons specified by ViBa Mart</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Products may be subject to verification before a return or refund is approved.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Customers may be required to provide photographs, videos, or other information to assist with verification.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Certain products may be marked as non-returnable.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">11.</span> Refunds
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              If a refund is approved, the refund amount and processing method may depend on:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Payment method</li>
              <li>Order status</li>
              <li>Product condition</li>
              <li>Return/cancellation eligibility</li>
              <li>Applicable fees or deductions</li>
              <li>Verification results</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              For online payments, approved refunds may be sent to the original payment method.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              For COD orders, refund processing may require verification of payment and delivery status and may use the applicable refund method supported by ViBa Mart.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Processing times may vary depending on the payment provider or financial institution.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">12.</span> Warranty and Brand Support
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Some products may include manufacturer, seller, or brand warranty/support.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Where warranty information is provided, the applicable warranty period and terms are those displayed for the relevant product.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Warranty claims may be subject to the manufacturer's or brand's conditions.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart does not automatically provide a warranty for every product.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">13.</span> Coupons, Rewards and Offers
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may provide coupons, promotional offers, rewards, discounts, and other benefits.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Such offers may have:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Expiry dates</li>
              <li>Product restrictions</li>
              <li>Brand restrictions</li>
              <li>Minimum purchase requirements</li>
              <li>Usage limits</li>
              <li>Payment requirements</li>
              <li>Other eligibility conditions</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Coupons and rewards cannot be exchanged for cash unless expressly stated.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may cancel or invalidate an offer where misuse, fraud, technical errors, or violation of the applicable offer terms is identified.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">14.</span> Reviews and User Content
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Where ViBa Mart allows customers to submit reviews, ratings, photographs, videos, or other content, you agree that the content:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Must be truthful and relevant.</li>
              <li>Must not contain unlawful, abusive, threatening, or misleading material.</li>
              <li>Must not violate another person's rights.</li>
              <li>Must not contain malicious code or harmful material.</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              ViBa Mart may remove content that violates these requirements or applicable policies.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">15.</span> Prohibited Activities
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              You must not use ViBa Mart to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Commit fraud or deceive other users.</li>
              <li>Create accounts using false information.</li>
              <li>Abuse coupons, rewards, refunds, or promotional offers.</li>
              <li>Attempt unauthorized access to systems or accounts.</li>
              <li>Interfere with the operation or security of the Services.</li>
              <li>Upload malicious code or harmful content.</li>
              <li>Scrape or automatically collect data without authorization.</li>
              <li>Use the Services for unlawful purposes.</li>
              <li>Circumvent security or access controls.</li>
            </ul>
          </section>

          <hr className="border-gray-100" />

          {/* Section 16 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">16.</span> Intellectual Property
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The ViBa Mart name, logo, branding, website design, software, graphics, text, interfaces, and other original content are protected by applicable intellectual-property laws.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              You may not reproduce, modify, distribute, sell, or commercially exploit ViBa Mart's proprietary materials without appropriate authorization.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Product names, trademarks, logos, and other materials belonging to third parties remain the property of their respective owners.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 17 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">17.</span> Third-Party Services
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may integrate with third-party services such as:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Payment providers</li>
              <li>Delivery/logistics providers</li>
              <li>Authentication providers</li>
              <li>Mapping/location services</li>
              <li>Communication or notification services</li>
            </ul>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed pt-2">
              Third-party services may have their own terms and privacy policies. ViBa Mart is not responsible for terms or practices that are solely controlled by third-party providers.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 18 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">18.</span> Service Availability
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              We aim to keep ViBa Mart available and functioning reliably, but uninterrupted availability cannot be guaranteed.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The Services may occasionally be unavailable because of:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base">
              <li>Maintenance</li>
              <li>Updates</li>
              <li>Technical problems</li>
              <li>Security incidents</li>
              <li>Infrastructure failures</li>
              <li>Events outside our reasonable control</li>
            </ul>
          </section>

          <hr className="border-gray-100" />

          {/* Section 19 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">19.</span> Limitation of Liability
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              To the extent permitted by applicable law, ViBa Mart will not be responsible for indirect or consequential losses arising from circumstances outside its reasonable control.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Nothing in these Terms is intended to exclude or limit rights or remedies that cannot legally be excluded or limited under applicable law.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 20 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">20.</span> Changes to These Terms
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              ViBa Mart may update these Terms when necessary.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The updated version will be published on the ViBa Mart website with a revised Last Updated date.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Your continued use of the Services after an update means that you agree to the updated Terms, to the extent permitted by applicable law.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 21 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">21.</span> Governing Law
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              These Terms are intended to be governed by the applicable laws of India.
            </p>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Any dispute will be handled according to the applicable jurisdiction and dispute-resolution requirements under Indian law.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 22 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">22.</span> Contact and Customer Support
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              For questions regarding orders, payments, delivery, cancellations, returns, refunds, or these Terms, customers should use the official ViBa Mart Customer Support / Order Help options available through the website or application.
            </p>
          </section>

          <hr className="border-gray-100" />

          {/* Section 23 */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">23.</span> Acceptance of Terms
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed font-medium">
              By using ViBa Mart, you acknowledge that you have read, understood, and agreed to these Terms of Service.
            </p>
          </section>

          {/* Footer Signature */}
          <div className="pt-6 border-t border-gray-200/80 bg-gray-50/80 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-black text-gray-900 text-lg">ViBa Mart</p>
              <p className="text-xs font-bold text-gray-500">Terms of Service</p>
            </div>
            <div className="text-xs font-semibold text-gray-500 bg-white px-3.5 py-2 rounded-xl border border-gray-200">
              Last Updated: September 28, 2026
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
