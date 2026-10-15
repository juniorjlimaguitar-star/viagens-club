'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtD = d => d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR') : '—'
const dig = v => String(v || '').replace(/\D/g, '')
const bv = { Pendente: 'b-warn', Confirmado: 'b-ok', Cancelado: 'b-grey' }
const bp = { 'Aguardando Sinal': 'b-warn', 'Sinal Pago': 'b-info', Quitado: 'b-ok', 'Em Atraso': 'b-err' }
export const dynamic = 'force-dynamic'

export default function Admin() {
  const [sessao, setSessao] = useState(undefined)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loginErro, setLoginErro] = useState('')
  const [reservas, setReservas] = useState([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [fin, setFin] = useState({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      if (data.session) carregar()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSessao(s); if (s) carregar() })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function carregar() {
    const { data } = await supabase.from('reservas').select('*').order('created_at', { ascending: false })
    setReservas(data || [])
  }

  async function login(ev) {
    ev.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setLoginErro('E-mail ou senha incorretos.')
  }

  async function logout() { await supabase.auth.signOut() }

  function clubMedText(r) {
    let t = '==============================\n*DADOS CLUBMED — RESPONSÁVEL*\n'
    t += `Nome completo: ${r.nome_responsavel}\nE-mail: ${r.email_responsavel}\nCelular: ${r.celular_responsavel}\nData de nascimento: ${r.data_nasc_responsavel}\nCPF: ${r.cpf_responsavel}\n--- Endereço ---\n`
    t += `CEP: ${r.cep}\nEndereço: ${r.endereco}\nBairro: ${r.bairro}\nCidade: ${r.cidade}\n`
    ;(r.acompanhantes || []).forEach((a, i) => { t += '------------------------------\n*ACOMPANHANTE ' + (i + 1) + `*\nNome completo: ${a.nome}\nData Nasc: ${a.data_nasc}\nCPF: ${a.cpf}\n` })
    return t + '=============================='
  }
  async function copiar(r) {
    try { await navigator.clipboard.writeText(clubMedText(r)) } catch (e) { }
    alert('Dados copiados! Agora é só colar no sistema do Club Med. ✅')
  }

  function gerarLink() {
    const token = Math.random().toString(36).slice(2, 10)
    const url = `${location.origin}/cadastro?token=${token}`
    const msg = `Olá! Para concluir o cadastro da sua reserva no Club Med, acesse o link e preencha os dados: ${url}`
    navigator.clipboard.writeText(url)
    setTimeout(() => { if (confirm('Link copiado! Abrir o WhatsApp para enviar ao cliente?')) window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank') }, 300)
  }

  function abrirEdit(r) {
    setEditando(r.id)
    setFin({ valor_total: r.valor_total, sinal_porcentagem: r.sinal_porcentagem, status_pagamento: r.status_pagamento, status_venda: r.status_venda, data_limite_saldo: r.data_limite_saldo || '' })
  }
  async function salvarEdit(r) {
    const vt = Number(fin.valor_total) || 0, sp = Number(fin.sinal_porcentagem) || 0
    const vs = vt * sp / 100
    await supabase.from('reservas').update({
      valor_total: vt, sinal_porcentagem: sp, valor_sinal: vs, saldo_restante: vt - vs,
      status_pagamento: fin.status_pagamento, status_venda: fin.status_venda, data_limite_saldo: fin.data_limite_saldo || null
    }).eq('id', r.id)
    setEditando(null); carregar()
  }
  async function excluir(r) {
    if (!confirm('Excluir esta reserva?')) return
    await supabase.from('reservas').delete().eq('id', r.id); carregar()
  }

  if (sessao === undefined) return <div className="wrap center"><p className="muted">Carregando...</p></div>

  if (!sessao) return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: '3rem' }}>
      <div className="card center">
        <div style={{ fontSize: '2.5rem' }}>🔒</div>
        <h2>Painel Viagens Club</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>Acesso restrito à administração</p>
        <form onSubmit={login} style={{ display: 'grid', gap: '.8rem' }}>
          <input className="input" type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} />
          {loginErro && <p style={{ color: '#ef4444', fontSize: '.8rem', margin: 0 }}>{loginErro}</p>}
          <button className="btn-p">Entrar</button>
        </form>
      </div>
    </div>
  )

  const filtradas = reservas.filter(r => !busca || r.nome_responsavel.toLowerCase().includes(busca.toLowerCase()) || dig(r.celular_responsavel).includes(dig(busca)))
  const totV = reservas.reduce((s, r) => s + (+r.valor_total || 0), 0)
  const totS = reservas.filter(r => ['Sinal Pago', 'Quitado'].includes(r.status_pagamento)).reduce((s, r) => s + (+r.valor_sinal || 0), 0)
  const totSaldo = reservas.reduce((s, r) => s + (+r.saldo_restante || 0), 0)
  const hoje = new Date()
  const vencendo = reservas.filter(r => r.saldo_restante > 0 && r.status_pagamento !== 'Quitado' && r.data_limite_saldo && (new Date(r.data_limite_saldo + 'T23:59:59') - hoje) < 48 * 3600 * 1000).length

  return (
    <div className="wrap">
      <div className="rowline" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1>📊 Painel Viagens Club</h1>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn-p" style={{ padding: '.55rem 1rem', fontSize: '.85rem' }} onClick={gerarLink}>🔗 Gerar Link</button>
          <button className="btn-o" onClick={logout}>Sair</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="t">Total em Vendas</div><div className="v">{money(totV)}</div></div>
        <div className="kpi"><div className="t">Sinais Recebidos</div><div className="v">{money(totS)}</div></div>
        <div className="kpi"><div className="t">Saldo a Receber</div><div className="v">{money(totSaldo)}</div></div>
        <div className="kpi"><div className="t">Vencendo 48h</div><div className="v" style={{ color: vencendo ? '#dc2626' : '#0f766e' }}>{vencendo}</div></div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <input className="input" placeholder="🔍 Buscar cliente ou WhatsApp" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {filtradas.length === 0 && <div className="card center muted">Nenhuma reserva ainda. Gere um link e envie ao primeiro cliente!</div>}

      {filtradas.map(r => {
        const acomps = r.acompanhantes || []
        const limite = r.data_limite_saldo ? new Date(r.data_limite_saldo + 'T23:59:59') : null
        const atrasado = limite && r.saldo_restante > 0 && r.status_pagamento !== 'Quitado' && limite < hoje
        return (
          <div className="reserva" key={r.id}>
            <div className="rowline" style={{ flexWrap: 'wrap', marginBottom: '.5rem' }}>
              <div>
                <b style={{ fontSize: '1.05rem' }}>{r.nome_responsavel}</b>
                <div className="muted" style={{ marginTop: '.2rem' }}>
                  📱 {r.celular_responsavel} · 👥 {acomps.length} acompanhante(s) · 🗓️ {fmtD(r.created_at?.slice(0, 10))}
                  {r.token && <> · 🔑 {r.token.toUpperCase()}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                <span className={'badge ' + (bv[r.status_venda] || 'b-grey')}>{r.status_venda}</span>
                <span className={'badge ' + (bp[r.status_pagamento] || 'b-grey')}>{r.status_pagamento}</span>
                {limite && <span className={'badge ' + (atrasado ? 'b-err' : 'b-ok')}>{atrasado ? '⚠️ ATRASADO: ' : 'Limite: '}{fmtD(r.data_limite_saldo)}</span>}
              </div>
            </div>

            <div className="muted" style={{ marginBottom: '.6rem' }}>🧑‍🤝‍🧑 {acomps.length ? acomps.map(a => a.nome).join(' · ') : 'Sem acompanhantes'}</div>

            <div className="grid2" style={{ marginBottom: '.2rem' }}>
              <div className="finbox">
                <div className="rowline"><span className="muted">Valor total</span><b>{money(r.valor_total)}</b></div>
                <div className="rowline"><span className="muted">Sinal ({r.sinal_porcentagem || 0}%)</span><span>{money(r.valor_sinal)}</span></div>
                <div className="rowline" style={{ borderTop: '1px solid #fff', paddingTop: '.3rem' }}><span className="muted"><b>Saldo restante</b></span><b style={{ color: '#0d9488' }}>{money(r.saldo_restante)}</b></div>
              </div>
              <div className="finbox" style={{ background: '#f8fafc' }}>
                <div className="rowline"><span className="muted">CPF</span><span style={{ fontSize: '.85rem' }}>{r.cpf_responsavel}</span></div>
                <div className="rowline"><span className="muted">Nascimento</span><span style={{ fontSize: '.85rem' }}>{fmtD(r.data_nasc_responsavel)}</span></div>
                <div className="rowline"><span className="muted">Cidade</span><span style={{ fontSize: '.85rem' }}>{r.cidade}</span></div>
              </div>
            </div>

            <div className="actions">
              <button className="btn-a" onClick={() => copiar(r)}>📋 Copiar para o Club Med</button>
              <button className="btn-o" onClick={() => window.open('https://wa.me/55' + dig(r.celular_responsavel), '_blank')}>💬 WhatsApp do cliente</button>
              <button className="btn-o" onClick={() => abrirEdit(r)}>💰 Financeiro / Status</button>
              <button onClick={() => excluir(r)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}>excluir</button>
            </div>

            {editando === r.id && (
              <div className="acompbox" style={{ marginTop: '.8rem' }}>
                <div className="grid3">
                  <div><label className="lbl">Valor total (R$)</label><input className="input" type="number" step="0.01" value={fin.valor_total} onChange={e => setFin(f => ({ ...f, valor_total: e.target.value }))} /></div>
                  <div><label className="lbl">Sinal (%)</label><input className="input" type="number" step="0.01" value={fin.sinal_porcentagem} onChange={e => setFin(f => ({ ...f, sinal_porcentagem: e.target.value }))} /></div>
                  <div><label className="lbl">Limite do saldo (48h)</label><input className="input" type="date" value={fin.data_limite_saldo} onChange={e => setFin(f => ({ ...f, data_limite_saldo: e.target.value }))} /></div>
                  <div><label className="lbl">Pagamento</label><select className="input" value={fin.status_pagamento} onChange={e => setFin(f => ({ ...f, status_pagamento: e.target.value }))}>{Object.keys(bp).map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="lbl">Venda</label><select className="input" value={fin.status_venda} onChange={e => setFin(f => ({ ...f, status_venda: e.target.value }))}>{Object.keys(bv).map(s => <option key={s}>{s}</option>)}</select></div>
                </div>
                <p className="muted" style={{ margin: '.6rem 0' }}>→ Sinal: {money((+fin.valor_total || 0) * (+fin.sinal_porcentagem || 0) / 100)} · Saldo restante: {money((+fin.valor_total || 0) - (+fin.valor_total || 0) * (+fin.sinal_porcentagem || 0) / 100)}</p>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button className="btn-a" onClick={() => salvarEdit(r)}>💾 Salvar</button>
                  <button className="btn-o" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
