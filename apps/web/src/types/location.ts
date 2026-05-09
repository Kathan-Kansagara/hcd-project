/**
 * Location data returned from pincode lookup API
 */
export interface LocationData {
  village?: string;
  city?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pincode?: string;
}
