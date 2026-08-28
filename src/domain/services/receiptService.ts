import { jsPDF } from 'jspdf';
import { Order, OrderItem } from '../../types';
import { ReceiptData } from '../entities/pos';

export function downloadPDFInvoice(order: Order | ReceiptData, restaurantName: string = 'Somali & Arabic Gourmet Restaurant') {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = '#0f172a'; // slate-900
  const accentColor = '#10b981'; // emerald-500
  const grayColor = '#64748b'; // slate-500

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');

  // Restaurant Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(restaurantName, 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL TAX INVOICE / RECEIPT', 14, 26);

  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129);
  doc.text(`INVOICE #${'orderNumber' in order ? order.orderNumber : 'ORD-1001'}`, 150, 18);

  const dateStr = 'createdAt' in order ? new Date(order.createdAt).toLocaleString() : ('timestamp' in order ? new Date(order.timestamp).toLocaleString() : new Date().toLocaleString());
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Date: ${dateStr}`, 150, 26);

  // Metadata Grid
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To:', 14, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(`Customer: ${order.customerName || 'Walk-in Customer'}`, 14, 51);
  if ('customerPhone' in order && order.customerPhone) {
    doc.text(`Phone: ${order.customerPhone}`, 14, 57);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Order Info:', 120, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order Type: ${(order.orderType || 'dine_in').toUpperCase()}`, 120, 51);
  if (order.tableNumber) {
    doc.text(`Table: ${order.tableNumber}`, 120, 57);
  }
  const employee = 'employeeName' in order ? order.employeeName : ('cashierName' in order ? order.cashierName : 'Staff');
  doc.text(`Cashier / Server: ${employee}`, 120, 63);

  // Table Header
  let startY = 72;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, startY, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Item Description', 18, startY + 5.5);
  doc.text('Qty', 110, startY + 5.5);
  doc.text('Unit Price', 135, startY + 5.5);
  doc.text('Total', 170, startY + 5.5);

  startY += 12;

  // Table Rows
  const items = order.items;
  items.forEach((item: any) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const itemName = item.productName || (item.product ? item.product.name : 'Item');
    doc.text(itemName, 18, startY);

    const qty = item.quantity;
    const unitP = item.unitPrice || (item.totalPrice / qty);
    const totalP = item.totalPrice;

    doc.setFont('helvetica', 'normal');
    doc.text(String(qty), 112, startY);
    doc.text(`$${unitP.toFixed(2)}`, 135, startY);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${totalP.toFixed(2)}`, 170, startY);

    startY += 6;

    // Selected options if any
    if (item.selectedOptions && item.selectedOptions.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      const optsText = item.selectedOptions.map((o: any) => o.choiceName).join(', ');
      doc.text(`  + Options: ${optsText}`, 18, startY);
      startY += 5;
    }

    // Notes if any
    if (item.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(`  Note: ${item.notes}`, 18, startY);
      startY += 5;
    }

    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(14, startY, 196, startY);
    startY += 5;
  });

  // Totals Summary Block
  startY += 5;
  doc.setFillColor(248, 250, 252);
  doc.rect(110, startY, 86, 38, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(110, startY, 86, 38, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const subtotal = order.subtotal || 0;
  const tax = order.tax || ('taxAmount' in order ? order.taxAmount : 0) || 0;
  const discount = ('discountAmount' in order ? order.discountAmount : ('discount' in order ? order.discount : 0)) || 0;
  const total = order.totalAmount || 0;

  doc.text('Subtotal:', 115, startY + 7);
  doc.text(`$${subtotal.toFixed(2)}`, 185, startY + 7, { align: 'right' });

  const taxRatePercent = order.taxRate ? (order.taxRate * 100).toFixed(0) : (subtotal > 0 && tax > 0 ? ((tax / subtotal) * 100).toFixed(0) : null);
  const taxLabel = taxRatePercent ? `Tax (${taxRatePercent}% VAT):` : 'Tax (VAT):';
  doc.text(taxLabel, 115, startY + 14);
  doc.text(`$${tax.toFixed(2)}`, 185, startY + 14, { align: 'right' });

  if (discount > 0) {
    doc.setTextColor(16, 185, 129);
    doc.text('Discount:', 115, startY + 21);
    doc.text(`-$${discount.toFixed(2)}`, 185, startY + 21, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', 115, startY + 31);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${total.toFixed(2)}`, 185, startY + 31, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for dining with us! Please keep this receipt for tax purposes.', 105, 280, { align: 'center' });

  // Save PDF
  const filename = `Invoice_${'orderNumber' in order ? order.orderNumber : 'Order'}.pdf`;
  doc.save(filename);
}
