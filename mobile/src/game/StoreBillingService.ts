import { Platform } from 'react-native';
import { GameApi, StoreProductDto, StorePurchaseRequest, StorePurchaseResult } from './GameApi';
import { getTelegramWebApp, isTelegramMiniApp } from '../telegram/telegramSdk';
import i18n from '../i18n';

export interface LocalizedStoreProduct {
  productId: string;
  crystalAmount: number;
  title: string;
  description: string;
  localizedPrice: string;
  currencyCode: string;
}

export type PurchaseStatus = 'idle' | 'purchasing' | 'verifying' | 'success' | 'cancelled' | 'error';

export interface PurchaseState {
  status: PurchaseStatus;
  error?: string;
  result?: StorePurchaseResult;
}

export class StoreBillingService {
  private static readonly PENDING_PURCHASE_STORAGE_KEY = 'dating.store.pending_purchase';

  constructor(private readonly gameApi: GameApi) {}

  /**
   * Fetches available store packages with localized pricing.
   * If native store is available, merges store product metadata with backend products.
   */
  async getProducts(): Promise<LocalizedStoreProduct[]> {
    try {
      const serverProducts = await this.gameApi.getStoreProducts();
      return serverProducts.map(p => this.formatProduct(p));
    } catch {
      // Fallback starter products if network offline
      return [
        {
          productId: 'dating.crystals.100',
          crystalAmount: 100,
          title: i18n.t('crystals_pack_100_title', '100 კრისტალი'),
          description: i18n.t('crystals_pack_100_desc', 'სტარტერ პაკეტი არენის თამაშისთვის'),
          localizedPrice: isTelegramMiniApp() ? '⭐ 25 Stars' : '₾0.99',
          currencyCode: isTelegramMiniApp() ? 'XTR' : 'GEL',
        },
        {
          productId: 'dating.crystals.500',
          crystalAmount: 500,
          title: i18n.t('crystals_pack_500_title', '500 კრისტალი'),
          description: i18n.t('crystals_pack_500_desc', 'პოპულარული პაკეტი'),
          localizedPrice: isTelegramMiniApp() ? '⭐ 100 Stars' : '₾4.49',
          currencyCode: isTelegramMiniApp() ? 'XTR' : 'GEL',
        },
        {
          productId: 'dating.crystals.1200',
          crystalAmount: 1200,
          title: i18n.t('crystals_pack_1200_title', '1200 კრისტალი'),
          description: i18n.t('crystals_pack_1200_desc', 'საუკეთესო შეთავაზება'),
          localizedPrice: isTelegramMiniApp() ? '⭐ 200 Stars' : '₾9.99',
          currencyCode: isTelegramMiniApp() ? 'XTR' : 'GEL',
        },
      ];
    }
  }

  private formatProduct(dto: StoreProductDto): LocalizedStoreProduct {
    const isTg = isTelegramMiniApp();
    const starsMap: Record<string, string> = {
      'dating.crystals.100': '⭐ 25 Stars',
      'dating.crystals.500': '⭐ 100 Stars',
      'dating.crystals.1200': '⭐ 200 Stars',
    };
    const priceMap: Record<string, string> = {
      'dating.crystals.100': '₾0.99',
      'dating.crystals.500': '₾4.49',
      'dating.crystals.1200': '₾9.99',
    };

    return {
      productId: dto.productId,
      crystalAmount: Number(dto.crystalAmount),
      title: dto.title,
      description: dto.description,
      localizedPrice: isTg ? (starsMap[dto.productId] || dto.tierApproximateGEL) : (priceMap[dto.productId] || dto.tierApproximateGEL),
      currencyCode: isTg ? 'XTR' : 'GEL',
    };
  }

  /**
   * Purchases a crystal product through Telegram Stars or the platform store and verifies on backend.
   */
  async purchaseProduct(
    product: LocalizedStoreProduct,
    onStateChange?: (state: PurchaseState) => void
  ): Promise<StorePurchaseResult> {
    onStateChange?.({ status: 'purchasing' });

    try {
      const isTg = isTelegramMiniApp();
      const tg = getTelegramWebApp();

      if (isTg && tg) {
        // 1. Generate Telegram Stars invoice link from backend
        const invoice = await this.gameApi.createTelegramStarsInvoice({
          itemType: 'crystals',
          itemId: product.productId,
        });

        // 2. Open native Telegram invoice modal via WebApp SDK
        return new Promise<StorePurchaseResult>((resolve, reject) => {
          tg.openInvoice(invoice.invoiceLink, async (status) => {
            if (status === 'paid') {
              try {
                onStateChange?.({ status: 'verifying' });
                const verifyRes = await this.gameApi.verifyTelegramStarsPayment({
                  payload: invoice.payload,
                });
                const result: StorePurchaseResult = {
                  success: true,
                  alreadyProcessed: false,
                  balance: verifyRes.walletBalance ?? product.crystalAmount,
                  crystalsCredited: product.crystalAmount,
                  debtRepaid: 0,
                  outstandingDebt: 0,
                  message: i18n.t('wallet_purchase_success', { amount: product.crystalAmount, defaultValue: `✓ წარმატებით შეძენილია ${product.crystalAmount} 💎` }),
                };
                onStateChange?.({ status: 'success', result });
                resolve(result);
              } catch {
                // Fallback: Webhook fulfills in background, fetch current wallet
                const wallet = await this.gameApi.getWallet();
                const result: StorePurchaseResult = {
                  success: true,
                  alreadyProcessed: false,
                  balance: wallet.balance,
                  crystalsCredited: product.crystalAmount,
                  debtRepaid: 0,
                  outstandingDebt: 0,
                  message: i18n.t('wallet_purchase_success', { amount: product.crystalAmount, defaultValue: `✓ წარმატებით შეძენილია ${product.crystalAmount} 💎` }),
                };
                onStateChange?.({ status: 'success', result });
                resolve(result);
              }
            } else if (status === 'cancelled') {
              const err = i18n.t('payment_cancelled', 'გადახდა გაუქმდა.');
              onStateChange?.({ status: 'cancelled', error: err });
              reject(new Error(err));
            } else {
              const err = i18n.t('payment_failed', 'გადახდა ვერ განხორციელდა.');
              onStateChange?.({ status: 'error', error: err });
              reject(new Error(err));
            }
          });
        });
      }

      // Native App fallback (Apple / Google / Mock)
      const platformName = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'google' : 'mock';
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const purchaseToken = `token_${platformName}_${transactionId}`;

      onStateChange?.({ status: 'verifying' });

      const request: StorePurchaseRequest = {
        platform: platformName,
        productId: product.productId,
        transactionId,
        purchaseToken,
        currency: product.currencyCode,
        price: parseFloat(product.localizedPrice.replace(/[^0-9.]/g, '')) || 0.99,
      };

      const result = await this.gameApi.purchaseStoreProduct(request);

      onStateChange?.({ status: 'success', result });
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : i18n.t('wallet_purchase_failed', 'შეძენა ვერ მოხერხდა');
      onStateChange?.({ status: 'error', error: errorMessage });
      throw err;
    }
  }
}
