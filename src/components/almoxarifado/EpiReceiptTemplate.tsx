import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReceiptData {
  authorizerName: string;
  authorizerMatricula: string;
  employeeName: string;
  employeeMatricula: string;
  employeeRole: string;
  destinationArea: string;
  reason: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  authorizerSignature: string | null;
  employeeSignature: string | null;
  date: Date;
}

export const EpiReceiptTemplate = forwardRef<HTMLDivElement, ReceiptData>((props, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '800px', // Fixed width for consistent generation
        padding: '40px',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        color: '#333',
        position: 'absolute',
        top: '-9999px', // Hide from screen, but available for html2canvas
        left: '-9999px',
        zIndex: -1
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <img src="/logo-relatorio.png" alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
        <div style={{ fontSize: '12px', color: '#666' }}>CONTRATO: 4600012690</div>
      </div>
      
      <div style={{ borderBottom: '2px solid #ccc', margin: '10px 0 30px 0' }}></div>

      {/* Title */}
      <h2 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', margin: '0 0 40px 0', color: '#333' }}>
        REQUISIÇÃO DE EPI
      </h2>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '14px' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>DATA:</strong> {format(props.date, 'dd/MM/yyyy', { locale: ptBR })}
          </div>
          <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>ÁREA DESTINO:</strong> {props.destinationArea || 'Almoxarifado'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 2, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>AUTORIZADO POR:</strong> {props.authorizerName}
          </div>
          <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>MATRÍCULA:</strong> {props.authorizerMatricula || '-'}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #999', paddingBottom: '4px' }}>
          <strong>MOTIVO:</strong> {props.reason || '.'}
        </div>

        <div style={{ borderBottom: '1px solid #999', paddingBottom: '4px' }}>
          <strong>FUNCIONÁRIO(A):</strong> {props.employeeName}
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 2, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>FUNÇÃO:</strong> {props.employeeRole || '-'}
          </div>
          <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: '4px' }}>
            <strong>MATRÍCULA:</strong> {props.employeeMatricula || '-'}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginTop: '30px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ backgroundColor: '#e2e8f0' }}>
              <th colSpan={2} style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #ddd', fontSize: '16px', color: '#333' }}>EPI</th>
            </tr>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #ddd', width: '80%', fontSize: '14px', color: '#333' }}>EPI / Uniforme</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #ddd', width: '20%', fontSize: '14px', color: '#333' }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            {props.items.length > 0 ? props.items.map((item, index) => (
              <tr key={index}>
                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.name}</td>
                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
              </tr>
            )) : (
              <tr>
                <td style={{ padding: '12px', border: '1px solid #ddd' }}>Nenhum item selecionado.</td>
                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #ddd' }}>-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '40px' }}>
        <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          {props.authorizerSignature && (
            <img 
              src={props.authorizerSignature} 
              alt="Assinatura do Autorizador" 
              style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', maxHeight: '80px' }} 
            />
          )}
          <div style={{ borderTop: '1px solid #333', paddingTop: '10px', fontSize: '12px', position: 'relative', zIndex: 1 }}>
            ASSINATURA DO AUTORIZADOR
          </div>
        </div>
        
        <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          {props.employeeSignature && (
            <img 
              src={props.employeeSignature} 
              alt="Assinatura do Funcionário" 
              style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', maxHeight: '80px' }} 
            />
          )}
          <div style={{ borderTop: '1px solid #333', paddingTop: '10px', fontSize: '12px', position: 'relative', zIndex: 1 }}>
            ASSINATURA DO FUNCIONÁRIO
          </div>
        </div>
      </div>
    </div>
  );
});

EpiReceiptTemplate.displayName = 'EpiReceiptTemplate';
