/**
 * Restaurant Employees screen tests.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

const mockUseFocusEffect = jest.fn((cb) => { cb(); });
jest.mock('expo-router', () => ({
  useFocusEffect: (cb) => mockUseFocusEffect(cb),
}));

jest.mock('../../../services/api', () => ({
  api: {
    getEmployees:   jest.fn(),
    createEmployee: jest.fn(),
    deleteEmployee: jest.fn(),
  },
}));

jest.mock('../../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }) => <View>{children}</View>;
});

const { api } = require('../../../services/api');
const EmployeesScreen = require('../employees').default;


beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getEmployees.mockResolvedValue([]);
});


describe('Employees screen', () => {
  test('empty state when no employees', async () => {
    const { findByText } = render(<EmployeesScreen />);
    expect(await findByText('No employees yet')).toBeDefined();
  });

  test('renders existing employees', async () => {
    api.getEmployees.mockResolvedValue([
      { id: 1, display_name: 'Anna', email: 'anna@x.com', role: 'chef' },
      { id: 2, display_name: 'Bob',  email: 'bob@x.com',  role: 'waiter' },
    ]);
    const { findByText } = render(<EmployeesScreen />);
    expect(await findByText('Anna')).toBeDefined();
    expect(await findByText('Bob')).toBeDefined();
  });

  test('Create posts to api.createEmployee with the form values', async () => {
    api.createEmployee.mockResolvedValue({
      id: 99, display_name: 'Carla', email: 'carla@x.com', role: 'sommelier',
    });
    const { findByText, getByPlaceholderText } = render(<EmployeesScreen />);

    const addBtn = await findByText('+ Add');
    fireEvent.press(addBtn);

    fireEvent.changeText(getByPlaceholderText('Full name'), 'Carla');
    fireEvent.changeText(getByPlaceholderText('email@example.com'), 'carla@x.com');
    fireEvent.changeText(getByPlaceholderText(/Initial password/), 'password123');

    const createBtn = await findByText('Create employee');
    fireEvent.press(createBtn);

    const { waitFor } = require('@testing-library/react-native');
    await waitFor(() => {
      expect(api.createEmployee).toHaveBeenCalledWith({
        email:        'carla@x.com',
        password:     'password123',
        display_name: 'Carla',
        role:         'waiter',
      });
    });
  });
});
