import { FC } from 'react';

interface ModalProps {
  message: string;
  onClose: () => void;
}

const Modal: FC<ModalProps> = ({ message, onClose }) => (
  <div className='modalBackdrop'>
    <div className='modal'>
      <p>{message}</p>
      <button className="button" onClick={onClose}>Close</button>
    </div>
  </div>
);

export default Modal;
