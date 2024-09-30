import React from 'react';
import { Modal } from 'antd';
import TerminalComponent from './TerminalComponent';

interface TerminalModalProps {
  visible: boolean;
  onClose: () => void;
  sshDetails: {
    neMake: string;
    neIp: string;
    gneIp: string;
    sshUsername: string;
    sshPassword: string;
    sshSecret?: string;
  };
}

export const TerminalModal: React.FC<TerminalModalProps> = ({ visible, onClose, sshDetails }) => {
  return (
    <Modal
      title="Command Line Interface"
      visible={visible}
      onCancel={onClose}
      footer={null} // 不需要底部按钮
      width={900} // 根据需要设置宽度
    >
      <TerminalComponent
        neMake={sshDetails.neMake}
        neIp={sshDetails.neIp}
        gneIp={sshDetails.gneIp}
        sshUsername={sshDetails.sshUsername}
        sshPassword={sshDetails.sshPassword}
        sshSecret={sshDetails.sshSecret}
      />
    </Modal>
  );
};

export default TerminalModal;