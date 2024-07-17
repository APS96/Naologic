export interface ProductDataVariantImage {
  fileName: string;
  cdnLink: string | null;
  i: number;
  alt: string | null;
}
export interface ProductDataVariantAttribute {
  packaging: string;
  description: string;
}
export interface ProductDataVariant {
  id: string;
  available: boolean;
  attributes: ProductDataVariantAttribute;
  cost: number;
  currency: string;
  depth: null;
  description: string;
  dimensionUom: null;
  height: null;
  width: null;
  manufacturerItemCode: string;
  manufacturerItemId: string;
  packaging: string;
  price: number;
  volume: null;
  volumeUom: null;
  weight: null;
  weightUom: null;
  optionName: string;
  optionsPath: string;
  optionItemsPath: string;
  sku: string;
  active: boolean;
  images: ProductDataVariantImage[];
  itemCode: string;
}

export interface ProductDataImage {
  fileName: string;
  cdnLink: string | null;
  i: number;
  alt: string | null;
}
export interface ProductDataOptionValue {
  id: string;
  name: string;
  value: string;
}
export interface ProductDataOption {
  id: string;
  name: string;
  dataField: string | null;
  values: ProductDataOptionValue[];
}
export interface ProductData {
  name: string;
  type: string;
  shortDescription: string;
  description: string;
  vendorId: string;
  manufacturerId: string;
  storefrontPriceVisibility: string;
  variants: ProductDataVariant[];
  options: ProductDataOption[];
  availability: string;
  isFragile: boolean;
  published: string;
  isTaxable: boolean;
  images: ProductDataImage[];
  categoryId: string;
}
export interface ProductInfo {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  deletedBy: string | null;
  deletedAt: string | null;
  dataSource: string;
  companyStatus: string;
  transactionId: string;
  skipEvent: boolean;
  userRequestId: string;
}
