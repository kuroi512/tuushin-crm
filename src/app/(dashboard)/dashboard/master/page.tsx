import { redirect } from 'next/navigation';

export default function LegacyMasterRedirect() {
  redirect('/master/type');
}
