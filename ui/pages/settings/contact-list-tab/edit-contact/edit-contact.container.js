import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { getAddressBookEntry } from '../../../../selectors';
import { getProviderConfig } from '../../../../ducks/metamask/metamask';
import {
  CONTACT_VIEW_ROUTE,
  CONTACT_LIST_ROUTE,
} from '../../../../helpers/constants/routes';
import {
  addToAddressBook,
  removeFromAddressBook,
} from '../../../../store/actions';
import EditContact from './edit-contact.component';

const mapStateToProps = (state, ownProps) => {
  const { location } = ownProps;
  const { pathname } = location;
  const pathNameTail = pathname.match(/[^/]+$/u)[0];
  const pathNameTailIsAddress = pathNameTail.includes('0x');
  const address = pathNameTailIsAddress
    ? pathNameTail.toLowerCase()
    : ownProps.match.params.id;

  const contact =
    getAddressBookEntry(state, address) || state.metamask.identities[address];
  const { memo, name } = contact || {};

  const { caipChainId } = getProviderConfig(state);

  return {
    address: contact ? address : null,
    caipChainId,
    name,
    memo,
    viewRoute: CONTACT_VIEW_ROUTE,
    listRoute: CONTACT_LIST_ROUTE,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    addToAddressBook: (recipient, nickname, memo) =>
      dispatch(addToAddressBook(recipient, nickname, memo)),
    removeFromAddressBook: (caipChainId, addressToRemove) =>
      dispatch(removeFromAddressBook(caipChainId, addressToRemove)),
  };
};

export default compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
)(EditContact);
