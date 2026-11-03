const mockSdk = { configure: jest.fn(), logIn: jest.fn(), getProducts: jest.fn(), purchaseProduct: jest.fn(), restorePurchases: jest.fn() };
const mockSync = jest.fn();
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }));
jest.mock('../api', () => ({ api: { syncStorePurchases: mockSync } }));
const purchases = require('../nativePurchases');
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'public-test-key';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'public-test-key';
  mockSdk.logIn.mockResolvedValue({});
  mockSdk.purchaseProduct.mockResolvedValue({ customerInfo: { entitlements: { active: { forged: true } } } });
  mockSdk.restorePurchases.mockResolvedValue({});
});
test('purchase grants only the authenticated server result', async () => {
  mockSync.mockResolvedValue({ granted: true, plan: 'premium' });
  expect(await purchases.purchase('sku', 'member-a')).toEqual({ granted: true, plan: 'premium' });
  expect(mockSync).toHaveBeenCalledWith();
});
test('restore reconciles on server without sending a Google order ID', async () => {
  mockSync.mockResolvedValue({ granted: false, plan: 'free' });
  expect(await purchases.restore('member-a')).toEqual({ granted: false, plan: 'free' });
  expect(mockSdk.restorePurchases).toHaveBeenCalled();
  expect(mockSync).toHaveBeenCalledWith();
});
test('purchase verification outage asks for restore, not repurchase', async () => {
  mockSync.mockRejectedValue(new Error('offline'));
  await expect(purchases.purchase('sku', 'member-a')).rejects.toThrow('do not buy again');
});
test('cancelled purchase never requests a server grant', async () => {
  mockSdk.purchaseProduct.mockRejectedValue({ userCancelled: true });
  expect(await purchases.purchase('sku', 'member-a')).toEqual({ cancelled: true });
  expect(mockSync).not.toHaveBeenCalled();
});
test('failed identity switch prevents charging the previous account', async () => {
  mockSdk.logIn.mockRejectedValue(new Error('offline'));
  await expect(purchases.purchase('sku', 'member-b')).rejects.toThrow('sign in again');
  expect(mockSdk.purchaseProduct).not.toHaveBeenCalled();
});
