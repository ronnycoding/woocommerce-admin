/**
 * External dependencies
 */
import { Component } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { get } from 'lodash';
import { IconButton } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withDispatch } from '@wordpress/data';

/**
 * WooCommerce dependencies
 */
import { Card } from '@woocommerce/components';

/**
 * Internal dependencies
 */
import withSelect from 'wc-api/with-select';

class WelcomeCard extends Component {
	constructor( props ) {
		super( props );

		this.hide = this.hide.bind( this );
	}

	hide() {
		this.props.updateOptions( {
			woocommerce_marketing_overview_welcome_hidden: 'yes',
		} );
	}

	render() {
		const { isHidden } = this.props;

		if ( isHidden ) {
			return null;
		}

		return (
			<Card
				className="woocommerce-marketing-overview-welcome-card"
			>
				<IconButton
					icon="no-alt"
					label={ __( 'Hide', 'woocommerce-admin' ) }
					onClick={ this.hide }
					className="woocommerce-marketing-overview-welcome-card__hide-button"
				/>
				<h3>{ __( 'Grow your customer base and increase your sales with marketing tools built for WooCommerce.', 'woocommerce-admin' ) }</h3>

			</Card>
		)
	}
}

export default compose(
	withSelect( ( select ) => {
		const { getOptions } = select( 'wc-api' );
		const options = getOptions( [ 'woocommerce_marketing_overview_welcome_hidden' ] );
		const isHidden = get( options, [ 'woocommerce_marketing_overview_welcome_hidden' ], 'no' ) === 'yes';

		return {
			isHidden,
		};
	} ),
	withDispatch( ( dispatch ) => {
		const { updateOptions } = dispatch( 'wc-api' );
		return {
			updateOptions,
		};
	} )
)( WelcomeCard );

