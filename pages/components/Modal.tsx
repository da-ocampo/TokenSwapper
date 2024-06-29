import { FC } from 'react';

interface ModalProps {
  message?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

const Modal: FC<ModalProps> = ({ message, onClose, children }) => (
  <div className='modalBackdrop' onClick={onClose}>
    <div className='modal' onClick={(e) => e.stopPropagation()}>
      {message && <p>{message}</p>}
      {children}
      <button className="button" onClick={onClose}>Close</button>
    </div>
  </div>
);

export default Modal;