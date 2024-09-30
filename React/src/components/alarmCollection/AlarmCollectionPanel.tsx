import React from 'react';
import { Table } from 'antd';
import { ReactNode } from 'react';

interface AlarmCollectionPanelProps {
  trapData: any[]; // 告警数据
}

export const AlarmCollectionPanel: React.FC<AlarmCollectionPanelProps> = ({ trapData }) => {
  const columns = [
    {
      title: 'OID',
      dataIndex: 'oid',
      key: 'oid',
      render: (text: any, record: any): ReactNode => Object.keys(record)[0] as string,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (text: any, record: any): ReactNode => Object.values(record)[0] as string,
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={trapData.map((trap, index) => ({ key: index, ...trap }))}
        pagination={false}
        bordered
      />
    </div>
  );
};