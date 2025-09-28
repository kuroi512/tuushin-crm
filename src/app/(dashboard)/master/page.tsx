import { redirect } from 'next/navigation';

export default function MasterIndex() {
  // Default category redirect (lowercase slug mapping) e.g. 'type'
  redirect('/master/sales');
}
