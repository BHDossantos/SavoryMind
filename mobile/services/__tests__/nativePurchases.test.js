const mockSdk = { configure: jest.fn(), logIn: jest.fn(), getProducts: jest.fn(), purchaseProduct: jest.fn(), restorePurchases: jest.fn() };
let mockToken = 'token-a';
const mockContext = jest.fn();
const mockSync = jest.fn();
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }));
jest.mock('../api', () => ({ api: { syncStorePurchases: mockSync, getStoreContext: mockContext }, tokenStore: { getAccess: async () => mockToken } }));
const purchases = require('../nativePurchases');
beforeEach(() => {
  mockToken = 'token-a';
  jest.clearAllMocks();
  mockContext.mockResolvedValue({ app_user_id: 'member-a', can_purchase: true, products: ['sku'] });
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'public-test-key';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'public-test-key';
  mockSdk.logIn.mockResolvedValue({});
  mockSdk.purchaseProduct.mockResolvedValue({ customerInfo: { entitlements: { active: { forged: true } } } });
  mockSdk.restorePurchases.mockResolvedValue({});
});
test('purchase grants only the authenticated server result', async () => {
  mockSync.mockResolvedValue({ granted: true, plan: 'premium' });
  expect(await purchases.purchase('sku', 'member-a')).toEqual({ granted: true, plan: 'premium' });
  expect(mockSync).toHaveBeenCalledWith('token-a');
});
test('restore reconciles on server without sending a Google order ID', async () => {
  mockSync.mockResolvedValue({ granted: false, plan: 'free' });
  expect(await purchases.restore('member-a')).toEqual({ granted: false, plan: 'free' });
  expect(mockSdk.restorePurchases).toHaveBeenCalled();
  expect(mockSync).toHaveBeenCalledWith('token-a');
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
  await expect(purchases.purchase('sku', 'member-b')).rejects.toThrow('Sign into the purchasing account');
  expect(mockSdk.purchaseProduct).not.toHaveBeenCalled();
});

test.each(['purchase', 'restore'])('switching accounts during %s never syncs to the new user', async action => {
  let finish;
  const deferred = new Promise(resolve => { finish = resolve; });
  await purchases.configure('member-a');
  (action === 'purchase' ? mockSdk.purchaseProduct : mockSdk.restorePurchases).mockReturnValue(deferred);
  const pending = action === 'purchase' ? purchases.purchase('sku', 'member-a') : purchases.restore('member-a');
  for (let i = 0; i < 15; i++) await Promise.resolve();
  expect(action === 'purchase' ? mockSdk.purchaseProduct : mockSdk.restorePurchases).toHaveBeenCalled();
  mockToken = 'token-b';
  const switched = purchases.configure('member-b');
  expect(mockSdk.logIn).not.toHaveBeenCalledWith('member-b');
  finish({});
  await expect(pending).rejects.toThrow('Account changed');
  expect(mockSync).not.toHaveBeenCalled();
  await switched;
  mockToken = 'token-a';
  mockSdk.restorePurchases.mockResolvedValue({});
  mockSync.mockResolvedValue({ granted: true, plan: 'premium' });
  expect(await purchases.restore('member-a')).toEqual({ granted: true, plan: 'premium' });
});


test.each([
  { app_user_id: 'member-a', can_purchase: false, products: ['sku'] },
  { app_user_id: 'member-b', can_purchase: true, products: ['sku'] },
  { app_user_id: 'member-a', can_purchase: true, products: ['other'] },
])('rechecks provider-specific eligibility before charging: %j', async context => {
  mockContext.mockResolvedValue(context);
  await expect(purchases.purchase('sku', 'member-a')).rejects.toThrow('not eligible');
  expect(mockSdk.purchaseProduct).not.toHaveBeenCalled();
  expect(mockSync).not.toHaveBeenCalled();
});
