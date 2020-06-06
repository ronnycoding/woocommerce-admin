/**
 * External dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import classnames from 'classnames';
import { cloneElement, Component, Fragment } from '@wordpress/element';
import { compose } from '@wordpress/compose';
import { Button, FormToggle } from '@wordpress/components';
import { withDispatch } from '@wordpress/data';

/**
 * WooCommerce dependencies
 */
import { Card, H, Plugins } from '@woocommerce/components';
import {
	getHistory,
	getNewPath,
	updateQueryString,
} from '@woocommerce/navigation';
import {
	ONBOARDING_STORE_NAME,
	pluginNames,
	PLUGINS_STORE_NAME,
} from '@woocommerce/data';

/**
 * Internal dependencies
 */
import { recordEvent } from 'lib/tracks';
import { getCountryCode } from 'dashboard/utils';
import withSelect from 'wc-api/with-select';
import { getPaymentMethods } from './methods';

class Payments extends Component {
	constructor( props ) {
		super( ...arguments );
		const { methods } = props;

		const enabledMethods = {};
		let recommendedMethod = 'stripe';
		methods.forEach( ( { isEnabled, key, visible } ) => {
			enabledMethods[ key ] = isEnabled;
			if ( key === 'wcpay' && visible ) {
				recommendedMethod = 'wcpay';
			}
		} );

		this.state = {
			enabledMethods,
			configuringMethods: {},
			recommendedMethod,
		};

		this.completeTask = this.completeTask.bind( this );
		this.markConfigured = this.markConfigured.bind( this );
		this.markConfigurationFinished = this.markConfigurationFinished.bind(
			this
		);
		this.skipTask = this.skipTask.bind( this );
	}

	componentDidUpdate( prevProps ) {
		if ( prevProps === this.props ) {
			return;
		}
		const { createNotice, errors, methods, requesting } = this.props;

		methods.forEach( ( { key, title } ) => {
			if (
				prevProps.requesting[ key ] &&
				! requesting[ key ] &&
				errors[ key ]
			) {
				createNotice(
					'error',
					sprintf(
						__(
							'There was a problem updating settings for %s',
							'woocommerce-admin'
						),
						title
					)
				);
			}
		} );
	}

	completeTask() {
		const { createNotice, methods, updateOptions } = this.props;

		updateOptions( {
			woocommerce_task_list_payments: {
				completed: 1,
				timestamp: Math.floor( Date.now() / 1000 ),
			},
		} );

		recordEvent( 'tasklist_payment_done', {
			configured: methods
				.filter( ( method ) => method.isConfigured )
				.map( ( method ) => method.key ),
		} );

		createNotice(
			'success',
			__(
				'💰 Ka-ching! Your store can now accept payments 💳',
				'woocommerce-admin'
			)
		);

		getHistory().push( getNewPath( {}, '/', {} ) );
	}

	skipTask() {
		const { methods, updateOptions } = this.props;

		updateOptions( {
			woocommerce_task_list_payments: {
				skipped: 1,
				timestamp: Math.floor( Date.now() / 1000 ),
			},
		} );

		recordEvent( 'tasklist_payment_skip_task', {
			options: methods.map( ( method ) => method.key ),
		} );

		getHistory().push( getNewPath( {}, '/', {} ) );
	}

	markConfigured( method ) {
		const { enabledMethods } = this.state;

		this.markConfigurationFinished( method );
		this.setState( {
			enabledMethods: {
				...enabledMethods,
				[ method ]: true,
			},
		} );

		getHistory().push( getNewPath( { task: 'payments' }, '/', {} ) );

		recordEvent( 'tasklist_payment_connect_method', {
			payment_method: method,
		} );
	}

	markConfigurationFinished( method ) {
		this.setState( {
			configuringMethods: {
				[ method ]: false,
			},
		} );
	}

	getCurrentMethod() {
		const { methods, query } = this.props;

		if ( ! query.method ) {
			return;
		}

		return methods.find( ( method ) => method.key === query.method );
	}

	getInstallStep( currentMethod ) {
		if ( ! currentMethod.plugins || ! currentMethod.plugins.length ) {
			return;
		}

		const { activePlugins } = this.props;
		const pluginsToInstall = currentMethod.plugins.filter(
			( method ) => ! activePlugins.includes( method )
		);
		const pluginNamesString = currentMethod.plugins
			.map( ( pluginSlug ) => pluginNames[ pluginSlug ] )
			.join( ' ' + __( 'and', 'woocommerce-admin' ) + ' ' );

		return {
			key: 'install',
			label: sprintf(
				__( 'Install %s', 'woocommerce-admin' ),
				pluginNamesString
			),
			content: (
				<Plugins
					onComplete={ () => {
						recordEvent( 'tasklist_payment_install_method', {
							plugins: currentMethod.plugins,
						} );
					} }
					onError={ () =>
						this.markConfigurationFinished( currentMethod )
					}
					autoInstall
					pluginSlugs={ currentMethod.plugins }
				/>
			),
			isComplete: ! pluginsToInstall.length,
		};
	}

	toggleMethod( key ) {
		const { methods, options, updateOptions } = this.props;
		const { enabledMethods } = this.state;
		const method = methods.find( ( option ) => option.key === key );

		enabledMethods[ key ] = ! enabledMethods[ key ];
		this.setState( { enabledMethods } );

		recordEvent( 'tasklist_payment_toggle', {
			enabled: ! method.isEnabled,
			payment_method: key,
		} );

		updateOptions( {
			[ method.optionName ]: {
				...options[ method.optionName ],
				enabled: method.isEnabled ? 'no' : 'yes',
			},
		} );
	}

	getSetupElement( method ) {
		return cloneElement( method.container, {
			query: this.props.query,
			installStep: this.getInstallStep( method ),
			markConfigured: this.markConfigured,
			markConfigurationFinished: this.markConfigurationFinished.bind(
				this,
				method.key
			),
			hasCbdIndustry: method.hasCbdIndustry,
			key: 'setup-' + method.key,
		} );
	}

	render() {
		const currentMethod = this.getCurrentMethod();
		const { methods } = this.props;
		const {
			enabledMethods,
			recommendedMethod,
			configuringMethods,
		} = this.state;
		const configuredMethods = methods.filter(
			( method ) => method.isConfigured
		).length;

		const setupElements = methods.map( ( method ) => {
			const { key } = method;
			if ( currentMethod && currentMethod.key === key ) {
				return (
					<Card
						className="woocommerce-task-payment-method is-narrow"
						key={ 'setup-' + key }
					>
						{ this.getSetupElement( method ) }
					</Card>
				);
			} else if ( configuringMethods[ key ] ) {
				return this.getSetupElement( method );
			}
			return null;
		} );

		const methodsList = (
			<div className="woocommerce-task-payments">
				{ methods.map( ( method ) => {
					const {
						before,
						container,
						content,
						isConfigured,
						key,
						title,
						visible,
						hasInlineSetup,
					} = method;

					if ( ! visible ) {
						return null;
					}

					const classes = classnames(
						'woocommerce-task-payment',
						'is-narrow',
						! isConfigured &&
							'woocommerce-task-payment-not-configured',
						'woocommerce-task-payment-' + key
					);

					const isRecommended =
						key === recommendedMethod && ! isConfigured;
					const showRecommendedRibbon =
						isRecommended && key !== 'wcpay';
					const showRecommendedPill =
						isRecommended && key === 'wcpay';

					return (
						<Card key={ key } className={ classes }>
							<div className="woocommerce-task-payment__before">
								{ showRecommendedRibbon && (
									<div className="woocommerce-task-payment__recommended-ribbon">
										<span>
											{ __(
												'Recommended',
												'woocommerce-admin'
											) }
										</span>
									</div>
								) }
								{ before }
							</div>
							<div className="woocommerce-task-payment__text">
								<H className="woocommerce-task-payment__title">
									{ title }
									{ showRecommendedPill && (
										<span className="woocommerce-task-payment__recommended-pill">
											{ __(
												'Recommended',
												'woocommerce-admin'
											) }
										</span>
									) }
								</H>
								<div className="woocommerce-task-payment__content">
									{ content }
								</div>
							</div>
							<div className="woocommerce-task-payment__after">
								{ container && ! isConfigured ? (
									<Button
										isPrimary={ key === recommendedMethod }
										isDefault={ key !== recommendedMethod }
										isBusy={ configuringMethods[ key ] }
										onClick={ () => {
											recordEvent(
												'tasklist_payment_setup',
												{
													options: methods.map(
														( option ) => option.key
													),
													selected: key,
												}
											);
											if ( hasInlineSetup ) {
												this.setState( {
													configuringMethods: {
														[ key ]: true,
													},
												} );
											} else {
												updateQueryString( {
													method: key,
												} );
											}
										} }
									>
										{ __( 'Set up', 'woocommerce-admin' ) }
									</Button>
								) : (
									<FormToggle
										checked={ enabledMethods[ key ] }
										onChange={ () =>
											this.toggleMethod( key )
										}
										onClick={ ( e ) => e.stopPropagation() }
									/>
								) }
							</div>
						</Card>
					);
				} ) }
				<div className="woocommerce-task-payments__actions">
					{ configuredMethods.length === 0 ? (
						<Button isLink onClick={ this.skipTask }>
							{ __(
								'My store doesn’t take payments',
								'woocommerce-admin'
							) }
						</Button>
					) : (
						<Button isPrimary onClick={ this.completeTask }>
							{ __( 'Done', 'woocommerce-admin' ) }
						</Button>
					) }
				</div>
			</div>
		);

		return (
			<Fragment>
				{ setupElements }
				{ methodsList }
			</Fragment>
		);
	}
}

export default compose(
	withSelect( ( select ) => {
		const { getProfileItems } = select( ONBOARDING_STORE_NAME );
		const {
			getOptions,
			getUpdateOptionsError,
			isUpdateOptionsRequesting,
		} = select( 'wc-api' );

		const { getActivePlugins } = select( PLUGINS_STORE_NAME );
		const activePlugins = getActivePlugins();
		const profileItems = getProfileItems();
		const options = getOptions( [
			'woocommerce_default_country',
			'woocommerce_woocommerce_payments_settings',
			'woocommerce_stripe_settings',
			'woocommerce_ppec_paypal_settings',
			'woocommerce_payfast_settings',
			'woocommerce_square_credit_card_settings',
			'woocommerce_klarna_payments_settings',
			'woocommerce_kco_settings',
			'wc_square_refresh_tokens',
			'woocommerce_cod_settings',
			'woocommerce_bacs_settings',
			'woocommerce_bacs_accounts',
		] );
		const countryCode = getCountryCode(
			options.woocommerce_default_country
		);

		const methods = getPaymentMethods( {
			activePlugins,
			countryCode,
			options,
			profileItems,
		} );

		const errors = {};
		const requesting = {};
		methods.forEach( ( method ) => {
			errors[ method.key ] = Boolean(
				getUpdateOptionsError( [ method.optionName ] )
			);
			requesting[ method.key ] = Boolean(
				isUpdateOptionsRequesting( [ method.optionName ] )
			);
		} );

		return {
			countryCode,
			errors,
			profileItems,
			activePlugins,
			options,
			methods,
			requesting,
		};
	} ),
	withDispatch( ( dispatch ) => {
		const { createNotice } = dispatch( 'core/notices' );
		const { updateOptions } = dispatch( 'wc-api' );
		return {
			createNotice,
			updateOptions,
		};
	} )
)( Payments );