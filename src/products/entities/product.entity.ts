import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductData, ProductInfo } from '../types/product';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ collection: 'products', timestamps: true })
export class Product {
  @Prop()
  docId: string;

  @Prop({ type: Object }) // For now I don't know what fullData is. It's always null in the samples.
  fullData: any | null;

  @Prop({ type: Object }) // For now I don't know what data is. It's always empty in the samples.
  data: ProductData;

  @Prop({ type: Object }) // For now I don't know what dataPublic is. It's always empty in the samples.
  dataPublic: any;

  @Prop()
  immutable: boolean;

  @Prop()
  deploymentId: string;

  @Prop()
  docType: string;

  @Prop()
  namespace: string;

  @Prop()
  companyId: string;

  @Prop()
  status: string;

  @Prop({ type: Object })
  info: ProductInfo;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ 'data.name': 1 }, { unique: true }); // We could add also here the vendorId/companyId, but I'm not sure if it's necessary for the test
ProductSchema.index({ 'data.variants.itemCode': 1 }, { unique: true }); // We need to make sure itemCode is unique
