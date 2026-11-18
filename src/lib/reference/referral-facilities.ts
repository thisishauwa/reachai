export interface ReferralFacility {
  id: string;
  name: string;
  code: string;
  phone_e164: string | null;
  address_text: string | null;
  distance_label: string | null;
  opening_status: string | null;
  capabilities: ReferralFacilityCapability[];
}

export type ReferralFacilityCapability = "maternity";

export const REFERRAL_FACILITIES: ReferralFacility[] = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "REACH Clinic, Gyadi-gyadi",
    code: "REACH-GYADI",
    phone_e164: null,
    address_text: "Gyadi-gyadi, Kano",
    distance_label: null,
    opening_status: null,
    capabilities: ["maternity"],
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    name: "REACH Clinic, Kuje",
    code: "REACH-KUJE",
    phone_e164: null,
    address_text: "Kuje, Abuja",
    distance_label: null,
    opening_status: null,
    capabilities: ["maternity"],
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    name: "REACH eDokta Clinic, Tofa",
    code: "REACH-TOFA",
    phone_e164: null,
    address_text: "Yanoko, Tofa",
    distance_label: null,
    opening_status: null,
    capabilities: ["maternity"],
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    name: "Sen. Oluremi Tinubu Clinic",
    code: "SOT-CLINIC",
    phone_e164: null,
    address_text: null,
    distance_label: null,
    opening_status: null,
    capabilities: ["maternity"],
  },
];

export const REFERRAL_FACILITY_CODES = REFERRAL_FACILITIES.map((facility) => facility.code);

export function referralFacilityCapabilities(code: string): ReferralFacilityCapability[] {
  return REFERRAL_FACILITIES.find((facility) => facility.code === code)?.capabilities ?? [];
}
