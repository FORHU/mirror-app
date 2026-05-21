export enum FittingSlot {
  None               = "None",
  HeadGarment        = "HeadGarment",
  Glasses            = "Glasses",
  Earrings           = "Earrings",
  UpperGarment       = "UpperGarment",
  LowerGarment       = "LowerGarment",
  FullGarment        = "FullGarment",
  FootGarment        = "FootGarment",
  LeftHandAccessory  = "LeftHandAccessory",
  RightHandAccessory = "RightHandAccessory",
  NeckAccessory      = "NeckAccessory",
  WaistAccessory     = "WaistAccessory",
}

export interface Garment {
  id: string;
  name: string;
  imageUrl: string;
  slot: FittingSlot;
  garmentType?: string;
}

export interface GarmentSlot {
  slot: FittingSlot;
  label: string;
  garment: Garment | null;
  side?: "left" | "right";
}

export type SlotMap = Partial<Record<FittingSlot, GarmentSlot>>;

export function createEmptySlotMap(): SlotMap {
  return {
    [FittingSlot.HeadGarment]:        { slot: FittingSlot.HeadGarment,        label: "Head",         garment: null },
    [FittingSlot.Glasses]:            { slot: FittingSlot.Glasses,            label: "Glasses",      garment: null },
    [FittingSlot.Earrings]:           { slot: FittingSlot.Earrings,           label: "Earrings",     garment: null },
    [FittingSlot.UpperGarment]:       { slot: FittingSlot.UpperGarment,       label: "Upper",        garment: null },
    [FittingSlot.LowerGarment]:       { slot: FittingSlot.LowerGarment,       label: "Lower",        garment: null },
    [FittingSlot.FullGarment]:        { slot: FittingSlot.FullGarment,        label: "Full",         garment: null },
    [FittingSlot.FootGarment]:        { slot: FittingSlot.FootGarment,        label: "Footwear",     garment: null },
    [FittingSlot.LeftHandAccessory]:  { slot: FittingSlot.LeftHandAccessory,  label: "L. Hand",      garment: null },
    [FittingSlot.RightHandAccessory]: { slot: FittingSlot.RightHandAccessory, label: "R. Hand",      garment: null },
    [FittingSlot.NeckAccessory]:      { slot: FittingSlot.NeckAccessory,      label: "Neck",         garment: null },
    [FittingSlot.WaistAccessory]:     { slot: FittingSlot.WaistAccessory,     label: "Waist",        garment: null },
  };
}
