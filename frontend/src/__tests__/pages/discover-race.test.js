import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DiscoverPage from '../../pages/diner/discover';
import { api } from '../../services/api';
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }) }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../services/api', () => ({ api: { listSavedRestaurants: jest.fn(), discoverRestaurants: jest.fn() } }));
beforeEach(() => { jest.resetAllMocks(); api.listSavedRestaurants.mockResolvedValue([]); });
it('keeps the newest search when an older search fails late', async () => {
 let rejectOld;
 api.discoverRestaurants.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; })).mockResolvedValueOnce([]);
 render(<DiscoverPage />);
 await act(async () => { fireEvent.click(screen.getByText('discoverPage.moodRomantic')); });
 await act(async () => rejectOld(new Error('obsolete failure')));
 expect(screen.queryByText('obsolete failure')).not.toBeInTheDocument();
 expect(api.discoverRestaurants).toHaveBeenLastCalledWith({ mood: 'romantic' });
});
it('explains unavailable location and offers city search', async () => {
 api.discoverRestaurants.mockResolvedValue([]);
 Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
 await act(async () => { render(<DiscoverPage />); });
 fireEvent.click(screen.getByText(/discoverPage.nearMe/));
 expect(screen.getByRole('alert')).toHaveTextContent('Enter a city');
});
