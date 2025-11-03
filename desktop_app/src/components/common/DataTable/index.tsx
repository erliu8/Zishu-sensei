import React from 'react';

export interface DataTableProps {
  data?: any[];
  columns?: Array<{ key: string; label: string }>;
}

/**
 * 数据表格组件
 */
const DataTable: React.FC<DataTableProps> = ({ data = [], columns = [] }) => {
  return (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;

