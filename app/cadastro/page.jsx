'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const WHATS = '5521964139796'
const dig = v => String(v || '').replace(/\D/g, '')
const maskCPF = v => { v = dig(v).slice(0, 11); return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') }
const maskFone = v => { v = dig(v).slice(0, 11); return v.length > 10 ? v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3') }
const maskCEP = v => { v = dig(v).slice(0, 8); return v.replace(/(\d{5})(\d{1,3})/, '$1-$2') }
function validCPF(cpf) {
  cpf = dig(cpf); if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  let s = 0; for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i)
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r != +cpf[9]) return false
  s = 0; for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i)
  r = (s * 10) % 11; if (r === 10) r = 0; return r == +cpf[10]
}
export const dynamic = 'force-dynamic'

export default function Cadastro() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [acomp, setAcomp] = useState([])
  const [form, setForm] = useState({ nome: '', email: '', celular: '', nasc: '', cpf: '', cep: '', endereco: '', bairro: '', cidade: '' })
  const [errs, setErrs] = useState({})
  const [enviado, setEnviado] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = k => e => {
    let v = e.target.value
    if (k === 'cpf') v = maskCPF(v)
    if (k === 'celular') v = maskFone(v)
    if (k === 'cep') v = maskCEP(v)
    setForm(f => ({ ...f, [k]: v }))
  }
  const setA = (i, k, v) => { if (k === 'cpf') v = maskCPF(v); setAcomp(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x)) }

  async function buscaCEP() {
    const cep = dig(form.cep)
    if (cep.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const d = await r.json()
      if (!d.erro) setForm(f => ({ ...f, endereco: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '' }))
    } catch (e) { }
  }

  function clubMedText() {
    let t = '==============================\n*DADOS CLUBMED — RESPONSÁVEL*\n'
    t += `Nome completo: ${form.nome}\nE-mail: ${form.email}\nCelular: ${form.celular}\nData de nascimento: ${form.nasc}\nCPF: ${form.cpf}\n`
    t += '--- Endereço ---\n'
    t += `CEP: ${form.cep}\nEndereço: ${form.endereco}\nBairro: ${form.bairro}\nCidade: ${form.cidade}\n`
    acomp.forEach((a, i) => { t += '------------------------------\n*ACOMPANHANTE ' + (i + 1) + `*\nNome completo: ${a.nome}\nData Nasc: ${a.nasc}\nCPF: ${a.cpf}\n` })
    return t + '=============================='
  }

  function validar() {
    const e = {}
    if (form.nome.trim().length < 5) e.nome = 1
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = 1
    if (dig(form.celular).length < 10) e.celular = 1
    if (!form.nasc) e.nasc = 1
    if (!validCPF(form.cpf)) e.cpf = 1
    if (dig(form.cep).length !== 8) e.cep = 1
    if (form.endereco.trim().length < 3) e.endereco = 1
    if (form.bairro.trim().length < 2) e.bairro = 1
    if (form.cidade.trim().length < 2) e.cidade = 1
    acomp.forEach((a, i) => {
      if (a.nome.trim().length < 5) e['a' + i + 'nome'] = 1
      if (!a.nasc) e['a' + i + 'nasc'] = 1
      if (!validCPF(a.cpf)) e['a' + i + 'cpf'] = 1
    })
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function enviar(ev) {
    ev.preventDefault()
    if (!validar()) return
    setLoading(true)
    const rec = {
      token, nome_responsavel: form.nome.trim(), email_responsavel: form.email.trim(),
      celular_responsavel: form.celular, data_nasc_responsavel: form.nasc, cpf_responsavel: form.cpf,
      cep: form.cep, endereco: form.endereco.trim(), bairro: form.bairro.trim(), cidade: form.cidade.trim(),
      acompanhantes: acomp.map(a => ({ nome: a.nome.trim(), data_nasc: a.nasc, cpf: a.cpf }))
    }
    const { error } = await supabase.from('reservas').insert(rec)
    setLoading(false)
    if (error) { alert('Erro ao enviar: ' + error.message); return }
    const msg = `Olá! Sou ${form.nome} e acabei de enviar meu cadastro de reserva pelo site Viagens Club.\n\n${clubMedText()}`
    setEnviado(`https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`)
  }

  if (enviado) return (
    <div className="wrap center" style={{ maxWidth: 520, paddingTop: '3rem' }}>
      <div style={{ fontSize: '4rem' }}>✅</div>
      <h1>Cadastro recebido!</h1>
      <p className="muted">Aguarde a confirmação pelo WhatsApp.</p>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Agora toque no botão abaixo e envie a mensagem que abrir no WhatsApp.</p>
      <a className="btn-p" href={enviado} target="_blank" style={{ display: 'inline-block', textDecoration: 'none' }}>📲 Enviar confirmação no WhatsApp</a>
    </div>
  )

  const E = k => errs[k] ? 'input-err' : ''
  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <div className="center" style={{ marginBottom: '1.5rem' }}>
        <h1>Cadastro de Reserva</h1>
        <p className="muted">Preencha os dados para sua estadia no Club Med. Após o envio, aguarde a confirmação pelo WhatsApp.</p>
        {token && <span className="badge b-info" style={{ marginTop: '.5rem' }}>Código: {token.toUpperCase()}</span>}
      </div>
      <form onSubmit={enviar}>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>1️⃣ Dados do Responsável</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div><label className="lbl">Nome completo *</label><input className={'input ' + E('nome')} value={form.nome} onChange={set('nome')} />{errs.nome && <div className="err on">Informe o nome completo.</div>}</div>
            <div className="grid2">
              <div><label className="lbl">E-mail *</label><input className={'input ' + E('email')} type="email" value={form.email} onChange={set('email')} />{errs.email && <div className="err on">E-mail inválido.</div>}</div>
              <div><label className="lbl">Celular / WhatsApp *</label><input className={'input ' + E('celular')} inputMode="numeric" value={form.celular} onChange={set('celular')} />{errs.celular && <div className="err on">Celular inválido.</div>}</div>
            </div>
            <div className="grid2">
              <div><label className="lbl">Data de nascimento *</label><input className={'input ' + E('nasc')} type="date" value={form.nasc} onChange={set('nasc')} />{errs.nasc && <div className="err on">Obrigatório.</div>}</div>
              <div><label className="lbl">CPF *</label><input className={'input ' + E('cpf')} inputMode="numeric" value={form.cpf} onChange={set('cpf')} />{errs.cpf && <div className="err on">CPF inválido.</div>}</div>
            </div>
            <div><label className="lbl">CEP *</label><input className={'input ' + E('cep')} inputMode="numeric" value={form.cep} onChange={set('cep')} onBlur={buscaCEP} />{errs.cep && <div className="err on">CEP inválido.</div>}</div>
            <div><label className="lbl">Endereço *</label><input className={'input ' + E('endereco')} value={form.endereco} onChange={set('endereco')} />{errs.endereco && <div className="err on">Informe o endereço.</div>}</div>
            <div className="grid2">
              <div><label className="lbl">Bairro *</label><input className={'input ' + E('bairro')} value={form.bairro} onChange={set('bairro')} />{errs.bairro && <div className="err on">Informe o bairro.</div>}</div>
              <div><label className="lbl">Cidade *</label><input className={'input ' + E('cidade')} value={form.cidade} onChange={set('cidade')} />{errs.cidade && <div className="err on">Informe a cidade.</div>}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="rowline" style={{ marginBottom: '1rem' }}>
            <h3>2️⃣ Acompanhantes</h3>
            <button type="button" className="btn-a" onClick={() => setAcomp(a => [...a, { nome: '', nasc: '', cpf: '' }])}>+ Adicionar</button>
          </div>
          {acomp.length === 0 && <p className="muted">Nenhum acompanhante. Viajando sozinho? Pode enviar assim mesmo. 😊</p>}
          {acomp.map((a, i) => (
            <div className="acompbox" key={i}>
              <div className="rowline" style={{ marginBottom: '.6rem' }}>
                <b style={{ color: '#0d9488', fontSize: '.85rem' }}>Acompanhante {i + 1}</b>
                <button type="button" onClick={() => setAcomp(x => x.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '.75rem', fontWeight: 700 }}>remover</button>
              </div>
              <div className="grid3">
                <div><label className="lbl">Nome completo *</label><input className={'input ' + E('a' + i + 'nome')} value={a.nome} onChange={e => setA(i, 'nome', e.target.value)} />{errs['a' + i + 'nome'] && <div className="err on">Obrigatório.</div>}</div>
                <div><label className="lbl">Data Nasc *</label><input className={'input ' + E('a' + i + 'nasc')} type="date" value={a.nasc} onChange={e => setA(i, 'nasc', e.target.value)} />{errs['a' + i + 'nasc'] && <div className="err on">Obrigatório.</div>}</div>
                <div><label className="lbl">CPF *</label><input className={'input ' + E('a' + i + 'cpf')} inputMode="numeric" value={a.cpf} onChange={e => setA(i, 'cpf', e.target.value)} />{errs['a' + i + 'cpf'] && <div className="err on">CPF inválido.</div>}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-p" style={{ width: '100%', padding: '1rem' }} disabled={loading}>{loading ? 'Enviando...' : 'Enviar Cadastro 📲'}</button>
        <p className="muted center" style={{ marginTop: '.6rem' }}>Ao enviar, o WhatsApp abrirá com uma mensagem de confirmação para a Viagens Club.</p>
      </form>
    </div>
  )
}
