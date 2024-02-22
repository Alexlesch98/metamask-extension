import React, { useContext, useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { ReactNode } from 'react-markdown';
import {
  getCurrentChainId,
  getCurrentCurrency,
  getCurrentKeyring,
  getIsBridgeChain,
  getIsBuyableChain,
  getIsSwapsChain,
  getMetaMetricsId,
  getSwapsDefaultToken,
} from '../../../selectors';
import {
  BackgroundColor,
  BlockSize,
  Display,
  FlexDirection,
  JustifyContent,
  TextColor,
  TextVariant,
} from '../../../helpers/constants/design-system';
import {
  Box,
  ButtonPrimary,
  ButtonSecondary,
  ButtonSecondarySize,
  Text,
} from '../../../components/component-library';
import { formatCurrency } from '../../../helpers/utils/confirm-tx.util';
import { hexToDecimal } from '../../../../shared/modules/conversion.utils';
import { useI18nContext } from '../../../hooks/useI18nContext';
import {
  AddressCopyButton,
  TokenListItem,
} from '../../../components/multichain';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventName,
  MetaMetricsSwapsEventSource,
} from '../../../../shared/constants/metametrics';
import { MetaMetricsContext } from '../../../contexts/metametrics';
import { startNewDraftTransaction } from '../../../ducks/send';
import {
  AssetType,
  TokenStandard,
} from '../../../../shared/constants/transaction';
import {
  BUILD_QUOTE_ROUTE,
  SEND_ROUTE,
} from '../../../helpers/constants/routes';
import { INVALID_ASSET_TYPE } from '../../../helpers/constants/error-keys';
import fetchWithCache from '../../../../shared/lib/fetch-with-cache';
import { MINUTE } from '../../../../shared/constants/time';
import TokenCell from '../../../components/app/token-cell';
import TransactionList from '../../../components/app/transaction-list';
import Tooltip from '../../../components/ui/tooltip';
import { getPortfolioUrl } from '../../../helpers/utils/portfolio';
import useRamps from '../../../hooks/experiences/useRamps';
import { setSwapsFromToken } from '../../../ducks/swaps/swaps';
import { isHardwareKeyring } from '../../../helpers/utils/hardware';
import AssetChart from './asset-chart';
import { getPricePrecision, localizeLargeNumber } from './util';
import AssetHeader from './asset-header';

const renderRow = (leftColumn: string, rightColumn: ReactNode) => (
  <Box display={Display.Flex} justifyContent={JustifyContent.spaceBetween}>
    <Text color={TextColor.textAlternative} variant={TextVariant.bodyMdMedium}>
      {leftColumn}
    </Text>
    {rightColumn}
  </Box>
);

const renderTooltip = (button: JSX.Element, text: string, show: boolean) =>
  show ? (
    <Tooltip wrapperClassName="asset-tooltip" title={text} position="bottom">
      {button}
    </Tooltip>
  ) : (
    <Box width={BlockSize.Full}>{button}</Box>
  );

// A page representing details for a native or token asset
const AssetV2 = ({
  asset,
}: {
  asset: (
    | {
        type: AssetType.native;
        isOriginalNativeSymbol: boolean;
      }
    | {
        type: AssetType.token;
        address: string;
        decimals: number;
        aggregators?: [];
      }
  ) & {
    symbol: string;
    name?: string;
    image: string;
    balance: {
      /**
       * A decimal representation of the balance before applying
       * decimals e.g. '12300000000000000' for 0.0123 ETH
       */
      value: string;

      /**
       * A displayable representation of the balance after applying
       * decimals e.g. '0.0123' for 12300000000000000 WEI
       */
      display: string;

      /** The balance's localized value in fiat e.g. '$12.34' or '56,78 €' */
      fiat?: string;
    };
    optionsButton: React.ReactNode;
  };
}) => {
  const t = useI18nContext();
  const dispatch = useDispatch();
  const history = useHistory();
  const trackEvent = useContext(MetaMetricsContext);

  const chainId = hexToDecimal(useSelector(getCurrentChainId));
  const currency = useSelector(getCurrentCurrency);
  const isSwapsChain = useSelector(getIsSwapsChain);
  const defaultSwapsToken = useSelector(getSwapsDefaultToken);
  const keyring = useSelector(getCurrentKeyring);
  const usingHardwareWallet = isHardwareKeyring(keyring?.type);
  const isBridgeChain = useSelector(getIsBridgeChain);
  const isBuyableChain = useSelector(getIsBuyableChain);
  const metaMetricsId = useSelector(getMetaMetricsId);
  const { openBuyCryptoInPdapp } = useRamps();

  const [marketData, setMarketData] = useState<any>();

  const headerRef = useRef(null);
  const balanceRef = useRef(null);

  const { type, symbol, name, image, balance, optionsButton } = asset;

  const address =
    type === AssetType.token
      ? asset.address
      : '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    setMarketData(undefined);

    fetchWithCache({
      url: `https://price-api.metafi.codefi.network/v2/chains/${chainId}/spot-prices/?includeMarketData=true&tokenAddresses=${address}&vsCurrency=${currency}`,
      cacheOptions: { cacheRefreshTime: MINUTE },
      functionName: 'GetAssetMarketData',
    })
      .catch(() => null)
      .then((data) => setMarketData(data?.[address.toLowerCase()]));
  }, [chainId, address, currency]);

  return (
    <Box
      display={Display.Flex}
      flexDirection={FlexDirection.Column}
      className="asset__wrapper"
    >
      <AssetHeader
        ref={headerRef}
        image={image}
        balance={balance}
        optionsButton={optionsButton}
      />
      <Box
        // Fade balance in/out of header
        onScroll={(e) =>
          headerRef?.current?.setBalanceOpacity(
            Math.max(0, Math.min(1, (e.target.scrollTop - 394) / 55)),
          )
        }
        display={Display.Flex}
        flexDirection={FlexDirection.Column}
        className="main-container asset__container"
        style={{ overflowY: 'auto' }}
      >
        <Box padding={4} paddingBottom={1}>
          <Text color={TextColor.textAlternative}>
            {name && symbol && name !== symbol
              ? `${name} (${symbol})`
              : name ?? symbol}
          </Text>
        </Box>
        <AssetChart address={address} currentPrice={marketData?.price} />
        <Box
          display={Display.Flex}
          flexDirection={FlexDirection.Column}
          paddingTop={6}
          gap={6}
        >
          <Box>
            <Text
              variant={TextVariant.headingMd}
              paddingBottom={2}
              paddingLeft={4}
            >
              {t('yourBalance')}
            </Text>
            <Box ref={balanceRef}>
              {type === AssetType.native ? (
                <TokenListItem
                  title={symbol}
                  tokenSymbol={symbol}
                  primary={balance.display}
                  secondary={balance.fiat}
                  tokenImage={image}
                  isOriginalTokenSymbol={asset.isOriginalNativeSymbol}
                  isNativeCurrency={true}
                />
              ) : (
                <TokenCell
                  address={address}
                  image={image}
                  symbol={symbol}
                  string={balance.display}
                />
              )}
            </Box>
            <Box
              display={Display.Flex}
              gap={[4, 12]}
              paddingLeft={[4, 12]}
              paddingRight={[4, 12]}
            >
              {renderTooltip(
                <ButtonSecondary
                  disabled={!isBridgeChain}
                  padding={5}
                  width={BlockSize.Full}
                  onClick={() => {
                    const portfolioUrl = getPortfolioUrl(
                      'bridge',
                      'ext_bridge_button',
                      metaMetricsId,
                    );
                    global.platform.openTab({
                      url: `${portfolioUrl}&token=${
                        type === AssetType.native ? 'native' : address
                      }`,
                    });
                    trackEvent({
                      category: MetaMetricsEventCategory.Navigation,
                      event: MetaMetricsEventName.BridgeLinkClicked,
                      properties: {
                        location: 'Asset Overview',
                        text: 'Bridge',
                        chain_id: chainId,
                        token_symbol: symbol,
                      },
                    });
                  }}
                >
                  {t('bridge')}
                </ButtonSecondary>,
                t('currentlyUnavailable'),
                !isBridgeChain,
              )}

              <Box width={BlockSize.Full}>
                <ButtonSecondary
                  padding={5}
                  width={BlockSize.Full}
                  onClick={async () => {
                    trackEvent({
                      event: MetaMetricsEventName.NavSendButtonClicked,
                      category: MetaMetricsEventCategory.Navigation,
                      properties: {
                        token_symbol: symbol,
                        location: MetaMetricsSwapsEventSource.TokenView,
                        text: 'Send',
                        chain_id: chainId,
                      },
                    });
                    try {
                      await dispatch(
                        startNewDraftTransaction({
                          type,
                          details:
                            type === AssetType.native
                              ? undefined
                              : {
                                  standard: TokenStandard.ERC20,
                                  decimals: asset.decimals,
                                  symbol,
                                  address,
                                },
                        }),
                      );
                      history.push(SEND_ROUTE);
                    } catch (err: any) {
                      if (!err?.message?.includes(INVALID_ASSET_TYPE)) {
                        throw err;
                      }
                    }
                  }}
                >
                  {t('send')}
                </ButtonSecondary>
              </Box>
            </Box>
          </Box>
          {type === AssetType.token && (
            <Box
              display={Display.Flex}
              flexDirection={FlexDirection.Column}
              paddingLeft={4}
              paddingRight={4}
            >
              <Text variant={TextVariant.headingMd} paddingBottom={4}>
                {t('tokenDetails')}
              </Text>
              {renderRow(
                t('contractAddress'),
                <AddressCopyButton address={address} shorten />,
              )}
              <Box
                display={Display.Flex}
                flexDirection={FlexDirection.Column}
                gap={2}
              >
                {asset.decimals !== undefined &&
                  renderRow(t('tokenDecimal'), <Text>{asset.decimals}</Text>)}
                {asset.aggregators && asset.aggregators?.length > 0 && (
                  <Box>
                    <Text
                      color={TextColor.textAlternative}
                      variant={TextVariant.bodyMdMedium}
                    >
                      {'Token list'} {/* TODO localize */}
                    </Text>
                    <Text>{asset.aggregators?.join(', ')}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          )}
          {(marketData?.marketCap > 0 ||
            marketData?.totalVolume > 0 ||
            marketData?.circulatingSupply > 0 ||
            marketData?.allTimeHigh > 0 ||
            marketData?.allTimeLow > 0) && (
            <Box paddingLeft={4} paddingRight={4}>
              <Text variant={TextVariant.headingMd} paddingBottom={4}>
                {t('marketDetails')}
              </Text>
              <Box
                display={Display.Flex}
                flexDirection={FlexDirection.Column}
                gap={2}
              >
                {marketData?.marketCap > 0 &&
                  renderRow(
                    t('marketCap'),
                    <Text>{localizeLargeNumber(t, marketData.marketCap)}</Text>,
                  )}
                {marketData?.totalVolume > 0 &&
                  renderRow(
                    t('totalVolume'),
                    <Text>
                      {localizeLargeNumber(t, marketData.totalVolume)}
                    </Text>,
                  )}
                {marketData?.totalVolume > 0 &&
                  marketData?.marketCap > 0 &&
                  renderRow(
                    `${t('volume')} / ${t('marketCap')}`,
                    <Text>
                      {(
                        marketData.totalVolume / marketData.marketCap
                      ).toPrecision(4)}
                    </Text>,
                  )}
                {marketData?.circulatingSupply > 0 &&
                  renderRow(
                    t('circulatingSupply'),
                    <Text>
                      {localizeLargeNumber(t, marketData.circulatingSupply)}
                    </Text>,
                  )}
                {marketData?.allTimeHigh > 0 &&
                  renderRow(
                    t('allTimeHigh'),
                    <Text>
                      {formatCurrency(
                        marketData.allTimeHigh,
                        currency,
                        getPricePrecision(marketData.allTimeHigh),
                      )}
                    </Text>,
                  )}
                {marketData?.allTimeLow > 0 &&
                  renderRow(
                    t('allTimeLow'),
                    <Text>
                      {formatCurrency(
                        marketData.allTimeLow,
                        currency,
                        getPricePrecision(marketData.allTimeLow),
                      )}
                    </Text>,
                  )}
              </Box>
            </Box>
          )}
          <Box marginBottom={5}>
            <Text
              paddingLeft={4}
              paddingRight={4}
              variant={TextVariant.headingMd}
            >
              {t('yourActivity')}
            </Text>
            {type === AssetType.native ? (
              <TransactionList hideTokenTransactions />
            ) : (
              <TransactionList tokenAddress={address} />
            )}
          </Box>
        </Box>
      </Box>
      <Box
        className="asset-footer"
        padding={4}
        paddingLeft={[4, 12]}
        paddingRight={[4, 12]}
        backgroundColor={BackgroundColor.backgroundDefault}
      >
        <Box display={Display.Flex} gap={[4, 12]}>
          {renderTooltip(
            <ButtonSecondary
              disabled={!isBuyableChain}
              size={ButtonSecondarySize.Md}
              padding={5}
              width={BlockSize.Full}
              onClick={() => {
                openBuyCryptoInPdapp();
                trackEvent({
                  event: MetaMetricsEventName.NavBuyButtonClicked,
                  category: MetaMetricsEventCategory.Navigation,
                  properties: {
                    location: 'Token Overview',
                    text: 'Buy',
                    chain_id: chainId,
                    token_symbol: symbol,
                  },
                });
              }}
            >
              {t('buy')}
            </ButtonSecondary>,
            t('currentlyUnavailable'),
            !isBuyableChain,
          )}
          {renderTooltip(
            <ButtonPrimary
              disabled={!isSwapsChain}
              padding={5}
              width={BlockSize.Full}
              onClick={() => {
                trackEvent({
                  event: MetaMetricsEventName.NavSwapButtonClicked,
                  category: MetaMetricsEventCategory.Swaps,
                  properties: {
                    token_symbol: symbol,
                    location: MetaMetricsSwapsEventSource.TokenView,
                    text: 'Swap',
                    chain_id: chainId,
                  },
                });
                dispatch(
                  setSwapsFromToken(
                    type === AssetType.native
                      ? defaultSwapsToken
                      : {
                          symbol,
                          name,
                          address,
                          decimals: asset.decimals,
                          iconUrl: image,
                          balance: balance.value,
                          string: balance.display,
                        },
                  ),
                );

                if (usingHardwareWallet) {
                  global.platform.openExtensionInBrowser(BUILD_QUOTE_ROUTE);
                } else {
                  history.push(BUILD_QUOTE_ROUTE);
                }
              }}
            >
              {t('swap')}
            </ButtonPrimary>,
            t('currentlyUnavailable'),
            !isBridgeChain,
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AssetV2;
