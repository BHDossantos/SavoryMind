import {test,expect} from '@playwright/test';
test('filter, reserve, cancel and reset sample activity',async({page})=>{
 await page.goto('/');await expect(page.locator('#banner')).toContainText('No real bookings');
 await page.locator('#category').selectOption({index:1});await expect(page.locator('.card')).toHaveCount(1);
 await page.getByRole('button',{name:'Reserve in demo',exact:true}).click();await expect(page.locator('#receipts')).toContainText('Reserved in demo');
 await page.getByRole('button',{name:'Cancel demo reservation'}).click();await expect(page.locator('#receipts')).toContainText('Cancelled');
 await page.getByRole('button',{name:'Reset demo',exact:true}).click();await expect(page.locator('#receipts')).toContainText('No demo reservations');
});
test('English and Italian controls render usable layouts',async({page})=>{
 await page.goto('/');await page.locator('#language').selectOption('it');await expect(page.locator('html')).toHaveAttribute('lang','it');
 await expect(page.locator('#banner')).toContainText('Nessuna prenotazione');await expect(page.getByRole('button',{name:'Prenota nella demo'}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('regulated home booking is blocked; fitness duplicate cannot reserve twice',async({page})=>{
 await page.goto('/');const regulated=page.locator('[data-item="plumb"]');
 if(await regulated.count()) {await expect(regulated.getByRole('button',{name:'Reserve in demo',exact:true})).toBeDisabled();await regulated.getByRole('button',{name:'Simulate quote request'}).click();await expect(page.locator('#status')).toContainText('No provider was contacted');}
 else {await page.locator('.card').first().getByRole('button',{name:'Reserve in demo',exact:true}).click();await page.locator('.card').first().getByRole('button',{name:'Reserve in demo',exact:true}).click();await expect(page.locator('#receipts .receipt')).toHaveCount(1);await expect(page.locator('#status')).toContainText('already reserved');}
});
test('reload resets activity and no external service is contacted',async({page})=>{
 const external=[];page.on('request',r=>{if(r.url().startsWith('http')&&!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
 await page.goto('/');await page.locator('.card').first().getByRole('button',{name:'Reserve in demo',exact:true}).click();await page.reload();
 await expect(page.locator('#receipts')).toContainText('No demo reservations');expect(external).toEqual([]);
});
