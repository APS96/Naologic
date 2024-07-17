import * as csv from '@fast-csv/parse';
import { OpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { determinCrontExpression } from 'src/utils/determine-cron-expression';
import { Product, ProductDocument } from './entities/product.entity';
import { CsvProduct } from './types/csvProduct';
import {
  ProductDataOption,
  ProductDataVariant,
  ProductDataVariantImage,
} from './types/product';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel('Product') private productModel: Model<Product>,
    private readonly configService: ConfigService,
  ) {}

  dataSource = 'nao'; // It's always "nao" like in the samples
  systemUser = 'IkFeiBarPUA3SNc3XiPY8yQl'; // It's always "IkFeiBarPUA3SNc3XiPY8yQl" like in the samples
  categoriesMap: Map<string, { id: string; name: string }> = new Map();
  limit = 0;

  getHello(): string {
    return 'Hello World!';
  }

  private createRandomString(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private calculateOptions(
    options: ProductDataOption[],
    packaging: string,
    itemDescription: string,
  ) {
    let packagingRandomId: string;
    let packagingValueRandomId: string;
    let descriptionRandomId: string;
    let descriptionValueRandomId: string;
    options.forEach((option) => {
      if (option.name === 'packaging') {
        packagingRandomId = option.id;
        let newId: string;
        option.values.forEach((value) => {
          if (value.value === packaging) {
            packagingValueRandomId = value.id;
          } else {
            packagingValueRandomId = this.createRandomString(6);
            newId = packagingValueRandomId;
          }
        });
        if (newId) {
          option.values.push({
            id: newId,
            name: packaging,
            value: packaging,
          });
        }
      } else if (option.name === 'description') {
        descriptionRandomId = option.id;
        let newId: string;
        option.values.forEach((value) => {
          if (value.value === itemDescription) {
            descriptionValueRandomId = value.id;
          } else {
            descriptionValueRandomId = this.createRandomString(6);
            newId = descriptionValueRandomId;
          }
        });
        if (newId) {
          option.values.push({
            id: newId,
            name: itemDescription,
            value: itemDescription,
          });
        }
      }
    });
    packagingRandomId = packagingRandomId || this.createRandomString(6);
    packagingValueRandomId =
      packagingValueRandomId || this.createRandomString(6);
    descriptionRandomId = descriptionRandomId || this.createRandomString(6);
    descriptionValueRandomId =
      descriptionValueRandomId || this.createRandomString(6);
    return {
      options,
      packagingRandomId,
      packagingValueRandomId,
      descriptionRandomId,
      descriptionValueRandomId,
    };
  }

  private createNewVariant(
    id: string | undefined,
    packaging: string,
    itemDescription: string,
    itemCost: number,
    itemPrice: number,
    manufacturerItemCode: string,
    packagingRandomId: string | undefined,
    packagingValueRandomId: string | undefined,
    descriptionRandomId: string | undefined,
    descriptionValueRandomId: string | undefined,
    images: ProductDataVariantImage[],
    itemCode: string,
  ): ProductDataVariant {
    if (!id) id = this.createRandomString(6);
    if (!packagingRandomId) packagingRandomId = this.createRandomString(6);
    if (!packagingValueRandomId)
      packagingValueRandomId = this.createRandomString(6);
    if (!descriptionRandomId) descriptionRandomId = this.createRandomString(6);
    if (!descriptionValueRandomId)
      descriptionValueRandomId = this.createRandomString(6);
    return {
      id,
      available: true, // It's always "available" like in the samples.
      attributes: {
        packaging,
        description: itemDescription,
      },
      cost: itemCost,
      currency: 'USD', // It's always "USD" like in the samples
      depth: null, // It's always null like in the samples
      description: itemDescription,
      dimensionUom: null, // It's always null like in the samples
      height: null, // It's always null like in the samples
      width: null, // It's always null like in the samples,
      manufacturerItemCode: manufacturerItemCode,
      manufacturerItemId: manufacturerItemCode, // Since I don't know where it comes from, I assume it's the same as ManufacturerItemCode even if in the samples it's different.
      packaging,
      price: itemPrice,
      volume: null, // It's always null like in the samples
      volumeUom: null, // It's always null like in the samples
      weight: null, // It's always null like in the samples
      weightUom: null, // It's always null like in the samples
      optionName: `${packaging},${itemDescription}`,
      optionsPath: `${packagingRandomId},${descriptionRandomId}`,
      optionItemsPath: `${packagingValueRandomId},${descriptionValueRandomId}`,
      sku: this.createRandomString(12), // This is an sku number, I don't know where it comes from and it's not on the . It's always different in the samples, so I will generate a random one.
      active: true, // It's always true like in the samples
      images,
      itemCode: itemCode, // I assume I am getting the item code from the ItemId in the CSV.
    };
  }

  // For time purposes I added the model here. The best way would be to have it in a service or a provider, and more
  // the case if it wil be used by multiple modules
  model = new OpenAI({
    model: 'gpt-4o',
    temperature: 0.9,
    apiKey: this.configService.get('OPEN_AI_KEY'),
  });

  async parseFile(fileInput: string, configInput: any) {
    const transactionId = nanoid();
    const userRequestId = nanoid();
    const productTransaction: Map<string, Product> = new Map();

    const mapFromFile = () =>
      new Promise((resolve) => {
        csv
          .parseFile(fileInput, configInput)
          .on('data', async (data: CsvProduct) => {
            const existingProduct = productTransaction.get(
              `${transactionId}-${data.ProductName}`,
            );
            const packaging = data.PKG;
            const itemDescription = data.ItemDescription;
            const itemPrice = Number(data.UnitPrice);
            const image = {
              fileName: '',
              cdnLink: null,
              i: 0,
              alt: null,
            };
            if (
              data.ItemImageURL &&
              data.ItemImageURL !== '' &&
              data.ImageFileName &&
              data.ImageFileName !== ''
            ) {
              image.fileName = data.ImageFileName;
              image.cdnLink = data.ItemImageURL;
            }
            // The CSV does not have cost, it just has price.
            // According to some calculations from the samples, the relationship between cost and price cost / 1.4. I assume that the cost is the price divided by 1.4.
            const itemCost = Number(data.UnitPrice) / 1.4;
            this.limit++;
            if (existingProduct?.docId) {
              const {
                packagingRandomId,
                packagingValueRandomId,
                descriptionRandomId,
                descriptionValueRandomId,
              } = this.calculateOptions(
                existingProduct.data.options,
                packaging,
                itemDescription,
              );
              const newVariant = {
                id: this.createRandomString(6),
                available: true,
                attributes: {
                  packaging,
                  description: itemDescription,
                },
                cost: itemCost,
                currency: 'USD',
                depth: null,
                description: itemDescription,
                dimensionUom: null,
                height: null,
                width: null,
                manufacturerItemCode: data.ManufacturerItemCode,
                manufacturerItemId: data.ManufacturerItemCode,
                packaging: packaging,
                price: itemPrice,
                volume: null,
                volumeUom: null,
                weight: null,
                weightUom: null,
                optionName: `${packaging},${itemDescription}`,
                optionsPath: `${packagingRandomId},${descriptionRandomId}`,
                optionItemsPath: `${packagingValueRandomId},${descriptionValueRandomId}`,
                sku: this.createRandomString(12),
                active: true,
                images: [image],
                itemCode: data.ItemID,
              };
              existingProduct.data.variants.push(newVariant);
              productTransaction.set(
                `${transactionId}-${data.ProductName}`,
                existingProduct,
              );
            } else {
              let categoryId = data.CategoryID;
              let categoryName = data.CategoryName;
              if (
                !categoryId ||
                !categoryName ||
                categoryId === '0' ||
                categoryName === ''
              ) {
                categoryId = data.SecondaryCategoryID;
                categoryName = data.SecondaryCategoryName;
                if (
                  !categoryId ||
                  !categoryName ||
                  categoryId === '0' ||
                  categoryName === ''
                ) {
                  categoryId = data.PrimaryCategoryID;
                  categoryName = data.PrimaryCategoryName;
                }
              }
              if (!this.categoriesMap.has(data.PrimaryCategoryID)) {
                this.categoriesMap.set(data.PrimaryCategoryID, {
                  id: data.PrimaryCategoryID,
                  name: data.PrimaryCategoryName,
                });
              }
              if (!this.categoriesMap.has(data.SecondaryCategoryID)) {
                this.categoriesMap.set(data.SecondaryCategoryID, {
                  id: data.SecondaryCategoryID,
                  name: data.SecondaryCategoryName,
                });
              }
              if (!this.categoriesMap.has(data.CategoryID)) {
                this.categoriesMap.set(data.CategoryID, {
                  id: data.CategoryID,
                  name: data.CategoryName,
                });
              }
              if (this.limit === 1) {
                // console.log('data:', data);
              }

              // We could enable here a logic of availability depending on the stock.
              // let available = false;
              // If theres Stock, then its available
              // if (Number(data.QuantityOnHand) > 0) {
              //   available = true;
              // }

              const docId = nanoid();
              const packagingRandomId = this.createRandomString(6);
              const packagingValueRandomId = this.createRandomString(6);
              const descriptionRandomId = this.createRandomString(6);
              const descriptionValueRandomId = this.createRandomString(6);
              const product: Product = {
                docId,
                fullData: null,
                data: {
                  name: data.ProductName,
                  type: 'non-inventory', // It's always "non-inventory" like in the samples
                  shortDescription: data.ProductDescription, // The short description is the same as the description in the samples
                  description: data.ProductDescription,
                  vendorId: docId, // According to task instructions: 'you will use the document ids for vendorId and manufacturerId.'
                  manufacturerId: docId, // According to task instructions: 'you will use the document ids for vendorId and manufacturerId.'. It can also be data.ManufacturerID
                  storefrontPriceVisibility: 'members-only', // It's always "members-only" like in the samples
                  variants: [
                    this.createNewVariant(
                      undefined,
                      packaging,
                      itemDescription,
                      itemCost,
                      itemPrice,
                      data.ManufacturerItemCode,
                      packagingRandomId,
                      packagingValueRandomId,
                      descriptionRandomId,
                      descriptionValueRandomId,
                      [image],
                      data.ItemID,
                    ),
                  ],
                  options: [
                    {
                      id: packagingRandomId, // According to task instructions: '-	Options[].id is just a random string '
                      name: 'packaging',
                      dataField: null, // Its always null in the samples
                      values: [
                        {
                          id: packagingValueRandomId, // According to task instructions: I assume is the same for the values id.
                          name: packaging,
                          value: packaging,
                        },
                      ],
                    },
                    {
                      id: descriptionRandomId, // According to task instructions: '-	Options[].id is just a random string '
                      name: 'description',
                      dataField: null, // Its always null in the samples
                      values: [
                        {
                          id: descriptionValueRandomId, // According to task instructions: I assume is the same for the values id.
                          name: itemDescription,
                          value: itemDescription,
                        },
                      ],
                    },
                  ],
                  availability: 'available', // It's always "available" like in the samples
                  isFragile: false, // It's always false like in the samples
                  published: 'published', // It's always "published" like in the samples
                  isTaxable: true, // It's always true like in the samples
                  images: [image],
                  categoryId, // The category ID is the same as the primary category ID in the samples
                },
                dataPublic: {},
                immutable: false,
                deploymentId: 'd8039', // May vary depending on the current deployment. Based on the samples, it's always "d8039".
                docType: 'item', // It's always "item" like in the samples
                namespace: 'items', // It's always "items" like in the samples
                companyId: '2yTnVUyG6H9yRX3K1qIFIiRz', // It's always "2yTnVUyG6H9yRX3K1qIFIiRz" like in the samples
                status: 'active', // It's always "active" like in the samples
                info: {
                  createdBy: this.systemUser, // It's always "IkFeiBarPUA3SNc3XiPY8yQl" like in the samples
                  createdAt: new Date().toISOString(), // It's always the current date like in the samples;
                  updatedBy: null, // Since we are creating, it's always null
                  updatedAt: null, // Since we are creating, it's always null
                  deletedBy: null, // Since we are creating, it's always null
                  deletedAt: null, // Since we are creating, it's always null
                  dataSource: this.dataSource,
                  companyStatus: 'active', // I am assuming the company status is active since it's always active in the samples
                  transactionId: transactionId,
                  skipEvent: false,
                  userRequestId: userRequestId,
                },
              };
              productTransaction.set(
                `${transactionId}-${data.ProductName}`,
                product,
              );
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('data-invalid', (row, rowNumber) => {
            // console.log(rowNumber);
            // console.log(row);
            // console.log(`\n`);
          })
          .on('end', () => {
            resolve(true);
          })
          .on('error', (error) => {
            console.log(error);
            resolve(false);
          });
      });
    await mapFromFile();

    const existingProducts = await this.productModel.find();
    // For optimization purposes I will iterate the transaction. But if we want to have the best realtime data, we should basically iterate the existing products to check if they come in the transaction
    // and soft delete the whole product.
    // We can optimize this by doing searches directly in the database, and even doing the search and upsert in the parse function, so we don't ahve to iterate over the products again.
    console.log('Processing products\n\n');
    const promises = [];
    let counter = 0;
    for (const [, value] of productTransaction) {
      this.processProduct(existingProducts, value, counter, transactionId);
      counter++;
    }
    // For time purposes I will use Promise.all, but in a real case scenario we should use a queue system or a pagination logic to avoid memory issues and db overload
    await Promise.all(promises);
    console.log('\n\nFinished processing products');
  }
  // We could also do the custom expression, 0 06 * * * to run at 6am, or modify this expression depending on the needs
  // Another approach can be a lambda in AWS that calls an API endpoint that triggers the same service function.

  // To test I use every 1 minute, CronExpression.EVERY_MINUTE
  // But in production we should use the cron expression CronExpression.EVERY_DAY_AT_6AM or whatever time is needed
  // It depends on Node Env
  @Cron(determinCrontExpression())
  handleCron() {
    // For time purposes we use the parse file to parse a local file.
    this.parseFile('images40.txt', {
      delimiter: '\t',
      headers: true,
      quote: false,
      trim: true,
      strictColumnHandling: true,
    });
  }

  private async processProduct(
    existingProducts: ProductDocument[],
    product: Product,
    counter: number,
    transactionId: string,
  ) {
    const foundProduct = existingProducts.find(
      (p) => p.data.name === product.data.name,
    );
    const categoryId = product.data.categoryId || foundProduct?.data.categoryId;
    const category = this.categoriesMap.get(categoryId);
    // On the prompt category will be ommitted if the category name is empty in the CSV. I only used the category, but one could do a logic to use primary category fields and secondary category fields
    // to try to get at least one real category per product
    // Limit ChatGPT search to only 10 products. . Which for multiple products will be the case.
    // I will use the chatGPT description enhancer to enhance only the actual products that we got from the vendor. It does not make sense costwise to enhance description of products that the vendor does not have anymore
    // even if they are in the DB.
    // Like this Item: 10162413, where the registry ends like "....Stock Item	6	Infection Control	63	Surface Wipes	0		N	N", meaning that 0 is the category Id and empty is the category name
    if (category && counter < 10) {
      console.log('Enhancing:', product.data.name);
      // We could add here in the prompt a limit of chars for the description so it does not get too long
      const prompt = `
        You are an expert in medical sales. Your specialty is medical consumables used by hospitals on a daily basis. Your task to enhance the description of a product based on the information provided.
        Product name: ${product.data.name}
        Product description: ${product.data.description}
        Category: ${category.name}
        New Description:
      `;
      const newDescription = await this.model.invoke(prompt);

      if (foundProduct) {
        foundProduct.data.description = newDescription;
        // We could even create a different prompt for the short description
        foundProduct.data.shortDescription = newDescription;
      } else {
        product.data.description = newDescription;
        // We could even create a different prompt for the short description
        product.data.shortDescription = newDescription;
      }
    }

    if (foundProduct) {
      // Check if its in a different transaction
      if (foundProduct.info.transactionId !== product.info.transactionId) {
        // Check if the product variants have changes
        const newVariants = [];
        product.data.variants.forEach((variant) => {
          const variantExists = foundProduct.data.variants.some(
            (v) => v.itemCode === variant.itemCode,
          );
          if (!variantExists) {
            newVariants.push(variant);
          }
        });
        foundProduct.data.variants.forEach((variant) => {
          const existingVariant = product.data.variants.find(
            (v) => v.itemCode === variant.itemCode,
          );
          if (!existingVariant) {
            variant.available = false; // Instead of deleting, I will do a soft delete switching status available to false. This way we can keep track of the changes and not loose data in case of existing relationship
            variant.active = false; // Instead of deleting, I will do a soft delete switching status active to false. This way we can keep track of the changes and not loose data in case of existing relationship
          } else {
            // I will only update certain fields that I consider for the changes.
            // On a real case, we should map this
            // I will force available and active if they were previosuly deleted.
            variant.cost = existingVariant.cost;
            variant.price = existingVariant.price;
            variant.packaging = existingVariant.packaging;
            variant.description = existingVariant.description;
            variant.active = true;
            variant.available = true;
          }
        });
        if (newVariants.length > 0) {
          foundProduct.data.variants = [
            ...foundProduct.data.variants,
            ...newVariants,
          ];
          product.data.options.forEach((option) => {
            const existingOption = foundProduct.data.options.find(
              (o) => o.name === option.name,
            );
            if (!existingOption) {
              foundProduct.data.options.push(option);
            } else {
              const newValues = option.values.filter(
                (v) =>
                  !existingOption.values.some((ev) => ev.value === v.value),
              );
              if (newValues.length > 0) {
                existingOption.values = [
                  ...existingOption.values,
                  ...newValues,
                ];
              }
            }
          });
          foundProduct.info.updatedBy = this.systemUser;
          foundProduct.info.updatedAt = new Date().toISOString();
          foundProduct.info.transactionId = transactionId;
        }
        await this.productModel.updateOne(
          { _id: foundProduct._id },
          foundProduct,
        );
      }
    } else {
      await this.create(product);
    }
  }

  async create(createProductDto: Product) {
    // if (createProductDto.docId === undefined) nanoid();
    const newProduct = new this.productModel(createProductDto);
    return newProduct.save();
  }

  findAll() {
    return `This action returns all products`;
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: Partial<Product>) {
    return `This action updates a #${id} product with ${updateProductDto}`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
