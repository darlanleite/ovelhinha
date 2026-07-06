import { test, expect } from '@playwright/test'

/**
 * E2E dos 3 fluxos críticos do Ovelhinha.
 *
 * PRÉ-REQUISITOS (por isso os testes ficam skip por padrão):
 *  - Projeto Supabase ativo com a migração 20260706_auth_and_rls.sql aplicada
 *  - Usuário de teste staff criado (E2E_EMAIL / E2E_PASSWORD no ambiente)
 *  - `npm run dev` rodando (ou baseURL configurada)
 *
 * Para rodar: E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
 */

const E2E_EMAIL = process.env.E2E_EMAIL
const E2E_PASSWORD = process.env.E2E_PASSWORD
const enabled = Boolean(E2E_EMAIL && E2E_PASSWORD)

test.describe('Fluxos críticos', () => {
  test.skip(!enabled, 'Defina E2E_EMAIL e E2E_PASSWORD para habilitar os testes E2E')

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('Recepção').click()
    await page.getByPlaceholder('voce@igreja.com').fill(E2E_EMAIL!)
    await page.getByPlaceholder('Sua senha').fill(E2E_PASSWORD!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('login da recepção abre o dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('cadastro → check-in de criança', async ({ page }) => {
    await page.goto('/cadastro')
    // TODO: preencher formulário com dados de teste e validar toast de sucesso
    await expect(page.getByText('Novo Cadastro')).toBeVisible()
  })

  test('acionar pulseira → pai chegou', async ({ page }) => {
    await page.goto('/acionar')
    // TODO: selecionar criança de teste, acionar, validar chamada aberta e responder
    await expect(page.getByPlaceholder(/Nome ou número/)).toBeVisible()
  })

  test('login sem credenciais não expõe dados', async ({ page }) => {
    await page.goto('/dashboard')
    // Sem sessão, deve voltar para o login
    await expect(page).toHaveURL('/')
  })
})
